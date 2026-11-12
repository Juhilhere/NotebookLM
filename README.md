# NotebookLM Clone - Advanced Corrective RAG Application

This repository contains a full-stack Next.js web application that mimics the core functionality of Google's NotebookLM. It allows users to upload documents (PDFs, TXT files) or paste web URLs, and then interactively query that knowledge base using an advanced, multi-step **Corrective Retrieval-Augmented Generation (CRAG)** pipeline.

## 🛠️ Technology Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, React 19)
- **Styling**: Vanilla CSS (Tailwind-free, utilizing custom minimalist terracotta/clay aesthetics)
- **LLM Provider**: [Groq API](https://groq.com/) (Lightning-fast inference)
- **Primary LLM Model**: `llama-3.1-8b-instant`
- **Embedding Provider**: [HuggingFace](https://huggingface.co/)
- **Embedding Model**: `sentence-transformers/all-MiniLM-L6-v2`
- **Vector Database**: [Qdrant](https://qdrant.tech/) (Cloud)
- **AI Orchestration**: [LangChain.js](https://js.langchain.com/)

---

## 🧠 The Advanced RAG Pipeline (Step-by-Step)

To prevent hallucinations and provide highly accurate answers, this application abandons the traditional "naive RAG" approach (embed question -> search -> generate) in favor of an exhaustive 9-step Corrective RAG pipeline.

### Step 1: Document Ingestion
When a user uploads a source, it is parsed into raw text:
- **PDFs**: Processed using `pdf-parse` (v1.1.1) to extract raw text buffers.
- **URLs**: Processed using `CheerioWebBaseLoader` to scrape the HTML content and extract readable paragraph text.
- **Text Files**: Directly read via buffer parsing.

### Step 2: Text Chunking
The raw text is split into overlapping chunks to preserve contextual boundaries. 
- **Tool**: `RecursiveCharacterTextSplitter`
- **Chunk Size**: `800` characters. This size is large enough to contain full thoughts and context but small enough to maintain high semantic density.
- **Chunk Overlap**: `150` characters. Ensures that sentences split across chunks don't lose their meaning.
- **Separators**: `["\n\n", "\n", ". ", " ", ""]` (Attempts to split by paragraphs first, then sentences, then words).

### Step 3: Embedding Generation
The chunks are converted into dense vector representations.
- **Model**: `sentence-transformers/all-MiniLM-L6-v2` via HuggingFace Inference API.
- This model generates 384-dimensional embeddings that are optimized for semantic search and run very fast.

### Step 4: Vector Storage
The embedded chunks, along with their metadata (source name, file size), are uploaded to a **Qdrant Vector Database** under a specific collection name (`notebooklm_docs` by default).

### Step 5: Query Rewriting & HyDE (Hypothetical Document Embeddings)
When the user asks a question in the chat interface, the query isn't immediately searched. Instead, it is sent to the LLM (Llama 3.1) to generate **four** new strings:
1. Three alternative, highly descriptive versions of the user's question (Query Expansion).
2. One short "Hypothetical Answer" (HyDE) that guesses what the answer might look like, thus generating target vocabulary and keywords that are likely to exist in the source document.

### Step 6: Multi-Query Parallel Retrieval
The system takes the original query + the 4 generated strings (5 total) and executes **parallel vector similarity searches** against Qdrant. 
It retrieves the top `4` closest chunks for *each* of the 5 queries, resulting in a raw pool of up to `20` chunks.

### Step 7: Deduplication & Frequency Re-Ranking
Because multiple queries might retrieve the exact same chunks, the pool of 20 chunks is flattened and de-duplicated.
The chunks are then **re-ranked based on frequency**—a chunk that was retrieved by 4 different query variations is deemed mathematically more relevant than a chunk retrieved by only 1 variation.
The system isolates the top `8` most relevant, unique chunks.

### Step 8: Corrective RAG (LLM-as-a-Judge)
To eliminate irrelevant information (which causes LLM hallucinations), the top 8 chunks are passed to the LLM acting as a strict grader. 
The LLM evaluates each chunk against the original user question. If the chunk contains no semantic relevance or keywords answering the question, its ID is discarded. The remaining chunks form the final, highly-vetted context window.

### Step 9: Grounded Generation
The final context window is injected into the System Prompt. The LLM is instructed with strict rules:
- Only answer using the provided context.
- If the answer isn't in the context, explicitly state: *"I couldn't find information about this in the document."*
- Never use general pre-training knowledge.

---

## 🚀 Deployment Guide :

This project is configured to deploy seamlessly to either **Render** or **Vercel**.

### Bypassing Peer Dependency Conflicts
The repository includes an `.npmrc` file in the root directory:
```ini
legacy-peer-deps=true
```
This forces the build environment to ignore upstream peer dependency conflicts (specifically between `@langchain/community`, `@browserbasehq/stagehand`, and `openai` versions), allowing the `npm install` phase to succeed automatically on both Render and Vercel.

### Deploying to Render (Recommended)
Render runs Next.js as a continuous Node.js Web Service, which avoids Vercel's strict 10-second serverless timeout limitations. This is highly recommended for Advanced RAG, as the LLM-as-a-judge and multi-query steps can sometimes exceed 10 seconds.
1. Connect your GitHub repository to a new **Web Service** on Render.
2. **Build Command**: `npm run build`
3. **Start Command**: `npm run start`
4. Add the required Environment Variables (see below).

### Deploying to Vercel
1. Import the GitHub repository into Vercel.
2. The framework preset will automatically detect Next.js.
3. Add the required Environment Variables.
*(Note: Vercel Free Tier limits serverless function execution to 10 seconds. If a RAG query takes longer than 10s, it will return a 544 Gateway Timeout).*

---

## 🔐 Environment Variables

Create a `.env.local` file (or add these to your hosting provider's dashboard):

```ini
# LLM Provider Configuration ("openai" or "groq")
LLM_PROVIDER=groq
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.1-8b-instant

# Embedding Provider Configuration ("openai" or "huggingface")
EMBEDDING_PROVIDER=huggingface
HUGGINGFACE_API_KEY=your_huggingface_token
HUGGINGFACE_MODEL=sentence-transformers/all-MiniLM-L6-v2

# Qdrant Database Configuration
QDRANT_URL=your_qdrant_cluster_url
QDRANT_API_KEY=your_qdrant_api_key
QDRANT_COLLECTION_NAME=notebooklm_docs
```

## 💻 Local Development

```bash
# Install dependencies (respecting the .npmrc legacy-peer-deps rule)
npm install

# Run the development server
npm run dev

# Run a local production build test
npm run build
npm start
```
