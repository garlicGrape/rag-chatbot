// pptx parsing: use officeparser or manual XML extraction
// We keep it simple: extract text per slide using the JSZip approach
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import type { LoadedChunk } from "./index.js";

const require = createRequire(import.meta.url);

export async function loadPptx(filePath: string, course: string): Promise<LoadedChunk[]> {
  // Dynamically import jszip — add to package.json if needed
  let JSZip: typeof import("jszip");
  try {
    JSZip = (await import("jszip")).default as unknown as typeof import("jszip");
  } catch {
    throw new Error("jszip is required for pptx loading — add it to ingest/package.json");
  }

  const buffer = fs.readFileSync(filePath);
  const zip = await (JSZip as unknown as { loadAsync: (b: Buffer) => Promise<{ files: Record<string, { async: (t: string) => Promise<string> }> }> }).loadAsync(buffer);
  const source_file = path.basename(filePath);
  const chunks: LoadedChunk[] = [];

  const slideFiles = Object.keys(zip.files)
    .filter((f) => f.match(/^ppt\/slides\/slide\d+\.xml$/))
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/)?.[0] ?? "0");
      const nb = parseInt(b.match(/\d+/)?.[0] ?? "0");
      return na - nb;
    });

  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.files[slideFiles[i]!]!.async("text");
    // Strip XML tags and extract text
    const text = xml
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length > 30) {
      chunks.push({ text, page_or_slide: i + 1, source_file, course });
    }
  }

  return chunks;
}
