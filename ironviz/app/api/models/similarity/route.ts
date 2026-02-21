import { NextRequest, NextResponse } from "next/server";
import { readModelArtifact, modelsDir } from "@/lib/model-artifacts";

type SimilarityNode = {
  grant_id: string;
  for4_code: string;
  for4_name: string;
  x_coord: number;
  y_coord: number;
  funding: number;
  institution_group: string;
  funder_name: string;
};

type SimilarityNeighbor = {
  grant_id: string;
  neighbor_grant_id: string;
  neighbor_for4_name: string;
  similarity: number;
};

export async function GET(request: NextRequest) {
  try {
    const [nodes, neighbors] = await Promise.all([
      readModelArtifact<SimilarityNode[]>("similarity_map_v1.json"),
      readModelArtifact<SimilarityNeighbor[]>("similarity_neighbors_v1.json"),
    ]);

    const grantId = request.nextUrl.searchParams.get("grant_id");
    if (!grantId) {
      return NextResponse.json({ version: "v1", data: nodes, source: modelsDir() });
    }

    const related = neighbors
      .filter((row) => row.grant_id === grantId)
      .sort((a, b) => b.similarity - a.similarity);
    return NextResponse.json({ version: "v1", grant_id: grantId, neighbors: related, source: modelsDir() });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to load similarity model artifact", detail: String(error) },
      { status: 500 },
    );
  }
}
