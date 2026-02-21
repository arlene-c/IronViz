import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "..", "backend", "data");

export async function readDataArtifact<T>(fileName: string): Promise<T> {
  const fullPath = path.join(DATA_DIR, fileName);
  const raw = await fs.readFile(fullPath, "utf-8");
  return JSON.parse(raw) as T;
}

export function dataDir(): string {
  return DATA_DIR;
}
