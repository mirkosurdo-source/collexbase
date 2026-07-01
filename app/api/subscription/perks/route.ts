import { NextResponse } from "next/server"
import { PLANS, PLAN_ORDER } from "@/lib/subscription"

/** Public endpoint: returns the full plan/perk catalog for the pricing UI. */
export async function GET() {
  return NextResponse.json({
    success: true,
    order: PLAN_ORDER,
    plans: PLAN_ORDER.map((id) => PLANS[id]),
  })
}
