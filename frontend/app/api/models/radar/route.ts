import { NextResponse } from "next/server";
import { modelsDir, readModelArtifact } from "@/lib/model-artifacts";

export async function GET() {
  try {
    const data = await readModelArtifact<unknown[]>("radar_competitiveness_v1.json");
    return NextResponse.json({ version: "v1", data, source: modelsDir() });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to load radar model artifact", detail: String(error) },
      { status: 500 },
    );
  }
}
