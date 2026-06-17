import fs from "fs";
import path from "path";
import type { LoadedChunk } from "./index.js";

export async function loadMd(filePath: string, course: string): Promise<LoadedChunk[]> {
  const content = fs.readFileSync(filePath, "utf8");
  const source_file = path.basename(filePath);

  // Split on H2/H3 headings as section boundaries
  const sections = content.split(/^#{2,3}\s/m).filter((s) => s.trim().length > 50);

  return sections.map((text, i) => ({
    text: text.trim(),
    page_or_slide: i + 1,
    source_file,
    course,
  }));
}
