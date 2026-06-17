import fs from "fs";
import pdfParse from "pdf-parse";
import type { LoadedChunk } from "./index.js";
import path from "path";

export async function loadPdf(filePath: string, course: string): Promise<LoadedChunk[]> {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  const source_file = path.basename(filePath);

  // pdf-parse doesn't give per-page text by default — use pagerender callback
  const pages: string[] = [];
  await pdfParse(buffer, {
    pagerender: (pageData: { getTextContent: () => Promise<{ items: Array<{ str: string; hasEOL?: boolean }> }> }) => {
      return pageData.getTextContent().then((tc) => {
        const text = tc.items.map((i) => i.str + (i.hasEOL ? "\n" : "")).join("");
        pages.push(text);
        return text;
      });
    },
  });

  if (pages.length === 0) {
    // fallback to full text as single chunk
    pages.push(data.text);
  }

  return pages.map((text, i) => ({
    text: text.trim(),
    page_or_slide: i + 1,
    source_file,
    course,
  })).filter((c) => c.text.length > 50);
}
