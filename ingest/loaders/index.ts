export interface LoadedChunk {
  text: string;
  page_or_slide: number | string;
  source_file: string;
  course: string;
}

export type Loader = (filePath: string, course: string) => Promise<LoadedChunk[]>;

export { loadPdf } from "./pdf.js";
export { loadPptx } from "./pptx.js";
export { loadDocx } from "./docx.js";
export { loadMd } from "./md.js";

import { loadPdf } from "./pdf.js";
import { loadPptx } from "./pptx.js";
import { loadDocx } from "./docx.js";
import { loadMd } from "./md.js";

export function getLoader(ext: string): Loader | null {
  switch (ext.toLowerCase()) {
    case ".pdf": return loadPdf;
    case ".pptx": return loadPptx;
    case ".docx": return loadDocx;
    case ".md": return loadMd;
    default: return null;
  }
}
