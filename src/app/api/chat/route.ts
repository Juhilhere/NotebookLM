import { NextRequest, NextResponse } from "next/server";
import { QdrantVectorStore } from "@langchain/qdrant";
import { getEmbeddings, getLlmClient } from "@/lib/ai";
import { Document } from "@langchain/core/documents";

export const runtime = "nodejs";
export const maxDuration = 60; // Increased duration for advanced pipeline

const SYSTEM_PROMPT_TEMPLATE = (context: string) => `You are a precise document assistant. Your ONLY job is to answer questions strictly based on the provided document context below.

RULES:
1. Only use information from the CONTEXT below to answer.
2. If the answer cannot be found in the context, say: "I couldn't find information about this in the document."
3. Never use your general knowledge or training data to answer.
4. Be concise but thorough. Use bullet points for lists.
5. When referencing specific information, you may indicate approximately where it appears in the document.

CONTEXT (extracted from the document):
---
${context}
---

Answer the user's question using ONLY the context above.`;

// 1. Query Rewriting / Sub-query Generation
async function generateSubQueries(question: string, client: any, model: string): Promise<string[]> {
  const prompt = `You are an AI assistant optimizing a search query for a vector database.
Your task is to generate 3 alternative, highly descriptive versions of the user's question. 
This helps overcome limitations of basic similarity search by expanding keywords and context (Query Rewriting).
Also, as the 4th item, generate a short "Hypothetical Answer" (HyDE) that contains keywords likely to be found in the target document.

Original Question: "${question}"

Output EXACTLY 4 lines. No numbers, no bullet points, just the raw text of the 3 queries followed by the hypothetical answer on the 4th line.`;

  try {
    const completion = await client.chat.completions.create({
      model: model,
      messages: [{ role: "system", content: prompt }],
      temperature: 0.7,
    });
    
    const text = completion.choices[0]?.message?.content || "";
    const queries = text.split('\n').map((q: string) => q.trim().replace(/^[-*0-9.]+\s*/, '')).filter((q: string) => q.length > 5);
    return queries;
  } catch (e) {
    console.error("Subquery generation failed:", e);
    return [];
  }
}

// 2. LLM as a Judge (Filtering)
async function filterRelevantChunks(chunks: Document[], question: string, client: any, model: string): Promise<Document[]> {
  if (chunks.length === 0) return [];
  
  const chunksText = chunks.map((c, i) => `[ID: ${i}]\n${c.pageContent}`).join('\n\n');
  
  const prompt = `You are an strict grader assessing the relevance of retrieved document chunks to a user question.
Your goal is to filter out irrelevant chunks (Corrective RAG) to prevent hallucinations.

User Question: "${question}"

Chunks:
${chunksText}

Analyze each chunk. If it contains ANY relevant information, keywords, or semantic meaning related to the question, it passes.
Output a comma-separated list of ONLY the IDs (e.g., 0, 2, 4) of the relevant chunks. If none are relevant, output "NONE".`;

  try {
    const completion = await client.chat.completions.create({
      model: model,
      messages: [{ role: "system", content: prompt }],
      temperature: 0.1,
    });
    
    const output = completion.choices[0]?.message?.content?.trim() || "";
    if (output === "NONE") return [];
    
    const validIds = output.split(',').map((id: string) => parseInt(id.trim())).filter((id: number) => !isNaN(id));
    return chunks.filter((_, i) => validIds.includes(i));
  } catch (e) {
    console.error("Chunk filtering failed:", e);
    // Fallback to returning all chunks if the LLM judge fails
    return chunks;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { question, collectionName } = body;

    if (!question || typeof question !== "string") {
      return NextResponse.json({ error: "No question provided" }, { status: 400 });
    }
    if (!collectionName || typeof collectionName !== "string") {
      return NextResponse.json({ error: "No collectionName provided" }, { status: 400 });
    }

    const { client: llmClient, model: llmModel } = getLlmClient();
    const embeddings = getEmbeddings();

    const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
      collectionName,
    });

    // --- STEP 1: Query Rewriting & HyDE ---
    const searchQueries = [question];
    const generatedQueries = await generateSubQueries(question, llmClient, llmModel);
    searchQueries.push(...generatedQueries);
    
    // --- STEP 2: Parallel Retrieval ---
    const retriever = vectorStore.asRetriever({ k: 4 });
    const retrievalPromises = searchQueries.map(q => retriever.invoke(q));
    const nestedDocs = await Promise.all(retrievalPromises);
    
    // Flatten the array of arrays
    const allDocs = nestedDocs.flat();

    // --- STEP 3: De-duplication & Re-ranking (Frequency based) ---
    // We count how many times a chunk was retrieved across different queries
    const docFrequency = new Map<string, { doc: Document, count: number }>();
    
    for (const doc of allDocs) {
      // Use pageContent as unique ID (or hash it). For simplicity, using first 200 chars as key
      const key = doc.pageContent.substring(0, 200); 
      if (docFrequency.has(key)) {
        docFrequency.get(key)!.count += 1;
      } else {
        docFrequency.set(key, { doc, count: 1 });
      }
    }

    // Sort by frequency (Re-ranking) and take top 8 unique chunks
    const uniqueRankedDocs = Array.from(docFrequency.values())
      .sort((a, b) => b.count - a.count)
      .map(item => item.doc)
      .slice(0, 8);

    if (uniqueRankedDocs.length === 0) {
      return NextResponse.json({
        answer: "I couldn't find any relevant information in the document for your question.",
        sources: [],
      });
    }

    // --- STEP 4: LLM as a Judge (Corrective Filter) ---
    const relevantDocs = await filterRelevantChunks(uniqueRankedDocs, question, llmClient, llmModel);

    // If filtering removed everything, fallback to top 3 from frequency re-ranking
    const finalDocs = relevantDocs.length > 0 ? relevantDocs : uniqueRankedDocs.slice(0, 3);

    // --- STEP 5: Build Context & Generate Answer ---
    const context = finalDocs.map((doc, i) => `[Chunk ${i + 1}]:\n${doc.pageContent}`).join("\n\n");

    const completion = await llmClient.chat.completions.create({
      model: llmModel,
      messages: [
        { role: "system", content: SYSTEM_PROMPT_TEMPLATE(context) },
        { role: "user", content: question },
      ],
      temperature: 0.1,
      max_tokens: 1024,
    });

    const answer = completion.choices[0]?.message?.content ?? "Sorry, I was unable to generate a response.";

    return NextResponse.json({
      answer,
      sources: finalDocs.map((d, i) => ({
        id: i + 1,
        snippet: d.pageContent.substring(0, 200) + "...",
      })),
      debug: {
        generatedQueries,
        totalRetrieved: allDocs.length,
        uniqueChunks: uniqueRankedDocs.length,
        filteredRelevant: relevantDocs.length
      }
    });
  } catch (err: unknown) {
    console.error("[/api/chat] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
