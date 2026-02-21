import { promises as fs } from "fs";
import path from "path";

const MODELS_DIR = path.resolve(process.cwd(), "..", "backend", "data", "models", "v1");

export async function readModelArtifact<T>(fileName: string): Promise<T> {
  const fullPath = path.join(MODELS_DIR, fileName);
  const raw = await fs.readFile(fullPath, "utf-8");
  return JSON.parse(raw) as T;
}

export function modelsDir(): string {
  return MODELS_DIR;
}
