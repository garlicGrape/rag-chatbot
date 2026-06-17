import fs from "fs";
import path from "path";
import type { LoadedChunk } from "./index.js";

export async function loadMd(filePath: string, course: string): Promise<LoadedChunk[]> {
  const content = fs.readFileSync(filePath, "utf8");
  const source_file = path.basename(filePath);

  return content
    .split(/^#{2,3}\s/m)
    .map((s) => s.trim())
    .filter((s) => s.length > 50)
    .map((text, i) => ({ text, page_or_slide: i + 1, source_file, course }));
}
