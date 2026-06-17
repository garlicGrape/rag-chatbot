import fs from "fs";
import path from "path";
import JSZip from "jszip";
import type { LoadedChunk } from "./index.js";

export async function loadPptx(filePath: string, course: string): Promise<LoadedChunk[]> {
  const buffer = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buffer);
  const source_file = path.basename(filePath);

  const slideFiles = Object.keys(zip.files)
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/)?.[0] ?? "0");
      const nb = parseInt(b.match(/\d+/)?.[0] ?? "0");
      return na - nb;
    });

  const chunks: LoadedChunk[] = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const file = zip.files[slideFiles[i]!];
    if (!file) continue;
    const xml = await file.async("text");
    const text = xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (text.length > 30) {
      chunks.push({ text, page_or_slide: i + 1, source_file, course });
    }
  }

  return chunks;
}
