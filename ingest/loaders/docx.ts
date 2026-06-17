import mammoth from "mammoth";
import path from "path";
import type { LoadedChunk } from "./index.js";

export async function loadDocx(filePath: string, course: string): Promise<LoadedChunk[]> {
  const result = await mammoth.extractRawText({ path: filePath });
  const source_file = path.basename(filePath);

  // Split into paragraphs as rough page proxies
  const paragraphs = result.value
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 50);

  return paragraphs.map((text, i) => ({
    text,
    page_or_slide: i + 1,
    source_file,
    course,
  }));
}
