import { NextRequest, NextResponse } from "next/server";
import { DecisionRequest, runResearcherDecision } from "@/lib/decision-engine";

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as DecisionRequest;
    if (!payload?.for4_code) {
      return NextResponse.json({ error: "for4_code is required" }, { status: 400 });
    }
    if (!payload?.cmu_campus_code) {
      return NextResponse.json({ error: "cmu_campus_code is required" }, { status: 400 });
    }
    const result = await runResearcherDecision(payload);
    return NextResponse.json({ version: "decision-v1", result });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to run researcher decision model", detail: String(error) },
      { status: 500 },
    );
  }
}
