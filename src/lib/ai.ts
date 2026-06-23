import { OpenAIEmbeddings } from "@langchain/openai";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import OpenAI from "openai";

export function getEmbeddings() {
  const provider = process.env.EMBEDDING_PROVIDER || "openai";

  if (provider === "huggingface") {
    if (!process.env.HUGGINGFACE_API_KEY) {
      throw new Error("HUGGINGFACE_API_KEY is not defined in environment variables.");
    }
    return new HuggingFaceInferenceEmbeddings({
      apiKey: process.env.HUGGINGFACE_API_KEY,
      model: process.env.HUGGINGFACE_MODEL || "sentence-transformers/all-MiniLM-L6-v2",
    });
  }

  // Default to OpenAI
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not defined in environment variables.");
  }
  return new OpenAIEmbeddings({
    model: "text-embedding-3-large",
    apiKey: process.env.OPENAI_API_KEY,
  });
}

export function getLlmClient() {
  const provider = process.env.LLM_PROVIDER || "openai";

  if (provider === "groq") {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY is not defined in environment variables.");
    }
    return {
      client: new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: "https://api.groq.com/openai/v1",
      }),
      model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
    };
  }

  // Default to OpenAI
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not defined in environment variables.");
  }
  return {
    client: new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    }),
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  };
}
