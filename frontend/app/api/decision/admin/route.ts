import { NextRequest, NextResponse } from "next/server";
import { runAdminDecision } from "@/lib/decision-engine";

type AdminPayload = {
  planning_horizon_months: number;
  current_funding?: number;
  portfolio: Array<{
    idea_text: string;
    cmu_campus_code: string;
    for4_code: string;
    project_length_months: number;
    budget_mode: "manual" | "auto";
    requested_budget?: number;
    already_received?: number;
  }>;
};

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as AdminPayload;
    if (!Array.isArray(payload?.portfolio) || payload.portfolio.length === 0) {
      return NextResponse.json({ error: "portfolio must include at least one project" }, { status: 400 });
    }
    const result = await runAdminDecision(payload);
    return NextResponse.json({ version: "decision-v1", result });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to run admin portfolio decision model", detail: String(error) },
      { status: 500 },
    );
  }
}
