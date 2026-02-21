import { NextResponse } from "next/server";
import { readModelArtifact, modelsDir } from "@/lib/model-artifacts";

export async function GET() {
  try {
    const data = await readModelArtifact<Record<string, unknown>>("model_meta.json");
    return NextResponse.json({ ...data, source: modelsDir() });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to load model metadata", detail: String(error) },
      { status: 500 },
    );
  }
}
