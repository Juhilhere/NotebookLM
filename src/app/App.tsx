"use client";

import React, { useState, useRef, useCallback, useEffect, FormEvent } from "react";

/* ——— SVG Icons (inline, no dependency) ——— */
const IconSparkle = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
  </svg>
);

const IconUpload = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const IconFile = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const IconSend = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconAlert = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

const IconBack = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
);

const IconBrain = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 01-2 2h-4a2 2 0 01-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z" />
    <line x1="10" y1="22" x2="14" y2="22" />
  </svg>
);

const IconChevron = ({ down }: { down: boolean }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ transition: "transform 0.2s", transform: down ? "rotate(0deg)" : "rotate(-90deg)" }}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const IconLock = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);

const IconZap = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const IconTarget = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
  </svg>
);

/* ——— TYPES ——— */
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: { text: string; score: number }[];
  debug?: {
    generatedQueries: string[];
    totalRetrieved: number;
    uniqueChunks: number;
    filteredRelevant: number;
  };
}

/* ——— HELPERS ——— */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}
function timeStr(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/* ═══════════════════════════════════════════════════════════ */
/*  PAGE COMPONENT                                             */
/* ═══════════════════════════════════════════════════════════ */

export default function Home() {
  /* ── state ── */
  const [view, setView] = useState<"upload" | "chat">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: "success" | "error"; msg: string; detail?: string } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [expandedSources, setExpandedSources] = useState<number | null>(null);
  const [collectionName, setCollectionName] = useState<string>("notebook_docs");

  const fileRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ── auto-scroll chat ── */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  /* ── auto-resize textarea ── */
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px"; }
  }, [input]);

  /* ── file handling ── */
  const handleFile = useCallback((f: File | undefined) => {
    if (!f) return;
    const ok = f.type === "application/pdf" || f.type === "text/plain" || f.name.endsWith(".pdf") || f.name.endsWith(".txt");
    if (!ok) { setUploadStatus({ type: "error", msg: "Unsupported format", detail: "Please upload a PDF or TXT file." }); return; }
    if (f.size > 10 * 1024 * 1024) { setUploadStatus({ type: "error", msg: "File too large", detail: "Maximum size is 10 MB." }); return; }
    setFile(f);
    setUploadStatus(null);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragActive(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  /* ── upload ── */
  const doUpload = async () => {
    if (!file && !url.trim()) return;
    setUploading(true);
    setUploadStatus(null);
    
    // Generate a unique collection name from the file name or URL
    const sourceName = file ? file.name : url.trim();
    const colName = "doc_" + sourceName.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 40) + "_" + Date.now();
    try {
      const form = new FormData();
      if (file) form.append("file", file);
      if (url.trim()) form.append("url", url.trim());
      form.append("collectionName", colName);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setCollectionName(data.collectionName || colName);
      setUploadStatus({ type: "success", msg: "Document processed!", detail: `${data.chunks} chunks indexed and ready.` });
      setTimeout(() => setView("chat"), 900);
    } catch (err: unknown) {
      setUploadStatus({ type: "error", msg: "Upload failed", detail: err instanceof Error ? err.message : "Unexpected error" });
    } finally {
      setUploading(false);
    }
  };

  /* ── chat ── */
  const sendMessage = async (e?: FormEvent) => {
    e?.preventDefault();
    const q = input.trim();
    if (!q || thinking) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: q }]);
    setThinking(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, collectionName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chat failed");
      setMessages((m) => [...m, {
        role: "assistant",
        content: data.answer,
        sources: data.sources?.map((s: { snippet: string }) => ({ text: s.snippet, score: 1 })),
        debug: data.debug
      }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Something went wrong. Please try again." }]);
    } finally {
      setThinking(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  /* ═══════════════════════════ UPLOAD VIEW ═══════════════════════════ */
  if (view === "upload") {
    return (
      <div className="app">
        <div className="bg-blob bg-blob-1" />
        <div className="bg-blob bg-blob-2" />

        {/* Main */}
        <main className="main-content">
          <div className="content-wrapper fade-in">

            {/* Hero */}
            <div className="hero">
              <h1>Chat with your <span className="accent">documents</span></h1>
              <p>Upload a PDF or text file and ask anything. Grounded answers with source citations, powered by retrieval-augmented generation.</p>
            </div>

            {/* Upload card */}
            <div className="glass-card">
              <div className="glass-card-label">Upload Document</div>

              <div
                className={`drop-zone ${dragActive ? "active" : ""} ${file ? "has-file" : ""}`}
                onClick={() => !file && !url && fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={onDrop}
                style={{ position: "relative", opacity: url ? 0.5 : 1, pointerEvents: url ? "none" : "auto" }}
              >
                <input ref={fileRef} type="file" accept=".pdf,.txt" hidden onChange={(e) => handleFile(e.target.files?.[0])} />

                {file ? (
                  <>
                    <div className="drop-icon has-file"><IconFile /></div>
                    <div className="file-name">{file.name}</div>
                    <div className="file-size">{formatBytes(file.size)}</div>
                    <button className="remove-btn" onClick={(e) => { e.stopPropagation(); setFile(null); setUploadStatus(null); }}>✕</button>
                  </>
                ) : (
                  <>
                    <div className="drop-icon"><IconUpload /></div>
                    <div className="drop-title">Drop your file here</div>
                    <div className="drop-sub">or <span className="link">click to browse</span></div>
                    <div className="drop-hint">PDF or TXT • Max 10 MB</div>
                  </>
                )}
              </div>

              <div style={{ margin: "16px 0", textAlign: "center", color: "var(--text-muted)", fontSize: "12px", fontWeight: 600 }}>OR</div>

              <div className="chat-input-row" style={{ opacity: file ? 0.5 : 1, pointerEvents: file ? "none" : "auto" }}>
                <input
                  type="text"
                  className="chat-input"
                  placeholder="Paste a web URL..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  style={{ padding: "8px 4px" }}
                />
              </div>

              {/* Upload button */}
              <button
                className="btn-primary"
                disabled={(!file && !url.trim()) || uploading}
                onClick={doUpload}
              >
                {uploading ? <><span className="spinner" /> Processing…</> : <><IconUpload /> Process Document</>}
              </button>

              {/* Status */}
              {uploadStatus && (
                <div className={`status-msg ${uploadStatus.type}`}>
                  <span className="icon" style={{ color: uploadStatus.type === "success" ? "#34d399" : "#f87171" }}>
                    {uploadStatus.type === "success" ? <IconCheck /> : <IconAlert />}
                  </span>
                  <div>
                    <div className="title">{uploadStatus.msg}</div>
                    {uploadStatus.detail && <div className="detail">{uploadStatus.detail}</div>}
                  </div>
                </div>
              )}
            </div>

          </div>
        </main>
      </div>
    );
  }

  /* ═══════════════════════════ CHAT VIEW ═══════════════════════════ */
  return (
    <div className="app">
      <div className="bg-blob bg-blob-1" />
      <div className="bg-blob bg-blob-2" />

      {/* Header */}
      <header className="header">
        <div className="header-brand">
          <button className="btn-secondary" onClick={() => setView("upload")} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <IconBack /> New Doc
          </button>
          <span className="header-title">NotebookLM Clone</span>
        </div>
        <span className="header-tagline">{file?.name || url}</span>
      </header>

      {/* Chat */}
      <main className="main-content" style={{ paddingTop: "20px", paddingBottom: "12px" }}>
        <div className="content-wrapper" style={{ maxWidth: "760px", flex: 1, display: "flex", flexDirection: "column" }}>

          <div className="chat-container fade-in">
            {/* Chat header */}
            <div className="chat-header">
              <div className="chat-header-icon"><IconBrain /></div>
              <div>
                <div className="chat-header-title">Document Chat</div>
                <div className="chat-header-sub">Ask questions about your uploaded document</div>
              </div>
            </div>

            {/* Messages */}
            <div className="chat-messages">
              {messages.length === 0 && !thinking && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "var(--text-muted)" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--accent-dim)" }}>
                    <IconBrain />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>Ready to chat</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", maxWidth: 280 }}>
                    Ask a question about your document and I&apos;ll find the relevant passages.
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`msg-row ${msg.role}`}>
                  <div className={`msg-avatar ${msg.role}`}>
                    {msg.role === "user" ? "U" : <IconSparkle />}
                  </div>
                  <div className="msg-body">
                    <div className={`msg-bubble ${msg.role}`}>
                      {msg.content}
                    </div>

                    {/* Sources */}
                    {msg.sources && msg.sources.length > 0 && (
                      <>
                        <button className="sources-toggle" onClick={() => setExpandedSources(expandedSources === i ? null : i)}>
                          <IconChevron down={expandedSources === i} />
                          {msg.sources.length} source{msg.sources.length > 1 ? "s" : ""}
                        </button>
                        {expandedSources === i && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {msg.sources.map((s, j) => (
                              <div key={j} className="source-chip">
                                <span className="num">[{j + 1}]</span>
                                {s.text.slice(0, 180)}{s.text.length > 180 ? "…" : ""}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {/* Debug Info / Advanced RAG Stats */}
                    {msg.debug && (
                      <div style={{ marginTop: "12px", padding: "12px", background: "rgba(139, 92, 246, 0.05)", border: "1px solid rgba(139, 92, 246, 0.2)", borderRadius: "10px", fontSize: "12px", color: "var(--text-secondary)" }}>
                        <div style={{ fontWeight: 600, color: "var(--accent)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                          <IconBrain /> Advanced RAG Process
                        </div>
                        <div style={{ marginBottom: "6px" }}>
                          <strong>1. Query Rewriting & HyDE:</strong>
                          <ul style={{ paddingLeft: "16px", marginTop: "4px", color: "var(--text-muted)" }}>
                            {msg.debug.generatedQueries.map((q, idx) => (
                              <li key={idx} style={{ marginBottom: "2px" }}>{q}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <strong>2. Multi-Query Retrieval & Filtering:</strong>
                          <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
                            <span>Retrieved: {msg.debug.totalRetrieved} chunks</span>
                            <span>→ Unique: {msg.debug.uniqueChunks}</span>
                            <span>→ LLM Relevant (Filtered): {msg.debug.filteredRelevant}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="msg-time">{timeStr()}</div>
                  </div>
                </div>
              ))}

              {thinking && (
                <div className="msg-row assistant">
                  <div className="msg-avatar assistant"><IconSparkle /></div>
                  <div className="msg-body">
                    <div className="msg-bubble assistant">
                      <div className="typing-indicator">
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="chat-input-area">
              <form onSubmit={sendMessage} className="chat-input-row">
                <textarea
                  ref={textareaRef}
                  className="chat-input"
                  rows={1}
                  placeholder="Ask about your document…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={thinking}
                />
                <button type="submit" className="send-btn" disabled={!input.trim() || thinking}>
                  <IconSend />
                </button>
              </form>
              <div className="chat-hint">Answers are grounded with document sources</div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
