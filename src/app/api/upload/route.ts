import { NextRequest, NextResponse } from "next/server";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { QdrantVectorStore } from "@langchain/qdrant";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { getEmbeddings } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // pdf-parse v1.1.1 exports a single function.
  // Under Next.js webpack, dynamic import can wrap it in { default: fn } or return fn directly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfParseModule = (await import("pdf-parse")) as any;
  const pdfParse =
    typeof pdfParseModule === "function"
      ? pdfParseModule
      : typeof pdfParseModule.default === "function"
        ? pdfParseModule.default
        : null;

  if (!pdfParse) {
    throw new Error("Failed to load pdf-parse module. Resolved export: " + JSON.stringify(Object.keys(pdfParseModule)));
  }

  const data = await pdfParse(buffer);
  return data.text;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const url = formData.get("url") as string | null;
    const collectionName = formData.get("collectionName") as string | null;

    if (!file && !url) {
      return NextResponse.json({ error: "No file or URL provided" }, { status: 400 });
    }
    if (!collectionName) {
      return NextResponse.json(
        { error: "No collectionName provided" },
        { status: 400 }
      );
    }

    let rawText = "";
    let sourceName = "";
    let sourceSize = 0;

    // --- 1. Extract text ---
    if (url) {
      try {
        const loader = new CheerioWebBaseLoader(url);
        const docs = await loader.load();
        rawText = docs.map(d => d.pageContent).join("\n\n");
        sourceName = url;
        sourceSize = rawText.length;
      } catch (err) {
        return NextResponse.json({ error: "Failed to load URL" }, { status: 400 });
      }
    } else if (file) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      sourceName = file.name;
      sourceSize = file.size;

      const fileName = file.name.toLowerCase();
      if (fileName.endsWith(".pdf")) {
        rawText = await extractTextFromPDF(buffer);
      } else if (fileName.endsWith(".txt") || fileName.endsWith(".md")) {
        rawText = buffer.toString("utf-8");
      } else {
        return NextResponse.json(
          { error: "Unsupported file type. Please upload a PDF, TXT or MD file." },
          { status: 400 }
        );
      }
    }

    if (!rawText || rawText.trim().length < 50) {
      return NextResponse.json(
        { error: "Could not extract meaningful text from the document or URL." },
        { status: 422 }
      );
    }

    // --- 2. Chunk the text (Recursive Character Text Splitter) ---
    // Strategy: Split on double newline (paragraph), then sentence, then word.
    // chunk_size=800, chunk_overlap=150 — balanced for good context per chunk.
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 800,
      chunkOverlap: 150,
      separators: ["\n\n", "\n", ". ", " ", ""],
    });

    const documents = await splitter.createDocuments(
      [rawText],
      [{ source: sourceName, fileSize: sourceSize }]
    );

    if (documents.length === 0) {
      return NextResponse.json(
        { error: "Document produced no usable chunks." },
        { status: 422 }
      );
    }

    // --- 3. Embed & store in Qdrant ---
    const embeddings = getEmbeddings();

    await QdrantVectorStore.fromDocuments(documents, embeddings, {
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
      collectionName,
    });

    return NextResponse.json({
      success: true,
      fileName: sourceName,
      chunks: documents.length,
      collectionName,
    });
  } catch (err: unknown) {
    console.error("[/api/upload] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
