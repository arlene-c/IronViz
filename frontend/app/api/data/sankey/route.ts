import { NextResponse } from "next/server";
import { dataDir, readDataArtifact } from "@/lib/data-artifacts";

export async function GET() {
  try {
    const data = await readDataArtifact<unknown[]>("sankey.json");
    return NextResponse.json({ version: "data-v1", data, source: dataDir() });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to load sankey data artifact", detail: String(error) },
      { status: 500 },
    );
  }
}
