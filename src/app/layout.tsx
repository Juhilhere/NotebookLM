import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NotebookLM Clone — Chat with Your Documents",
  description:
    "Upload any PDF or text file and have a grounded AI conversation with it. Powered by RAG.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
