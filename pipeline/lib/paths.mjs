import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// pipeline/lib/paths.mjs → repo root
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const PDF = join(ROOT, "input", "재난현장표준작전절차.pdf");
export const INPUT_DIR = join(ROOT, "input");
export const ONTOLOGY_DIR = join(ROOT, "ontology");
export const OUT_DIR = join(ROOT, "pipeline", "out");
