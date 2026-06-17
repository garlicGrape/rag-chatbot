import path from "path";
import mammoth from "mammoth";
import type { LoadedChunk } from "./index.js";

export async function loadDocx(filePath: string, course: string): Promise<LoadedChunk[]> {
  const result = await mammoth.extractRawText({ path: filePath });
  const source_file = path.basename(filePath);

  return result.value
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 50)
    .map((text, i) => ({ text, page_or_slide: i + 1, source_file, course }));
}
