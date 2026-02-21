import { NextResponse } from "next/server";
import { loadDecisionContext } from "@/lib/decision-engine";

export async function GET() {
  try {
    const { opportunity, campuses, sankey } = await loadDecisionContext();

    const fields = opportunity
      .map((r) => ({
        code: String(r.FOR4_CODE),
        name: r.FOR4_NAME,
        opportunity_score: Number(r.opportunity_score_v1 || 0),
      }))
      .sort((a, b) => b.opportunity_score - a.opportunity_score);

    const funders = [...new Set(sankey.map((s) => s.source).filter(Boolean))].slice(0, 50);

    return NextResponse.json({
      version: "decision-v1",
      campuses,
      fields,
      funders,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to load decision options", detail: String(error) },
      { status: 500 },
    );
  }
}
