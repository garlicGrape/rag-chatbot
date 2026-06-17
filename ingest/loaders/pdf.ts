import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";
import type { LoadedChunk } from "./index.js";

export async function loadPdf(filePath: string, course: string): Promise<LoadedChunk[]> {
  const buffer = fs.readFileSync(filePath);
  const source_file = path.basename(filePath);
  const pages: string[] = [];

  // Collect per-page text via the pagerender callback
  await pdfParse(buffer, {
    pagerender: (pageData: {
      getTextContent: () => Promise<{ items: Array<{ str: string; hasEOL?: boolean }> }>;
    }) =>
      pageData.getTextContent().then((tc) => {
        const text = tc.items.map((i) => i.str + (i.hasEOL ? "\n" : "")).join("");
        pages.push(text);
        return text;
      }),
  });

  // Fallback: whole-doc text as a single page
  if (pages.length === 0) {
    const data = await pdfParse(buffer);
    pages.push(data.text);
  }

  return pages
    .map((text, i) => ({ text: text.trim(), page_or_slide: i + 1, source_file, course }))
    .filter((c) => c.text.length > 50);
}
