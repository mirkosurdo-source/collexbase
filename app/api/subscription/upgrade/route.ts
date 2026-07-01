import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import {
  PLANS,
  applyPlanChange,
  getOrCreateSubState,
  isPlanId,
  planRank,
  type BillingCycle,
  type PlanId,
} from "@/lib/subscription"

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    const body = await req.json()
    const toPlan = body.plan as PlanId
    const cycle: BillingCycle = body.billingCycle === "yearly" ? "yearly" : "monthly"

    if (!isPlanId(toPlan)) {
      return NextResponse.json({ success: false, message: "Piano non valido." }, { status: 400 })
    }

    const state = await getOrCreateSubState(userId)
    const current = state.plan as PlanId

    if (planRank(toPlan) <= planRank(current)) {
      return NextResponse.json(
        { success: false, message: "Usa il downgrade per passare a un piano inferiore o uguale." },
        { status: 400 },
      )
    }

    // Placeholder payment step (no Stripe in this block).
    const result = await applyPlanChange({ userId, toPlan, cycle, event: "upgrade" })

    return NextResponse.json({
      success: true,
      message: `Abbonamento aggiornato a ${toPlan}.`,
      plan: toPlan,
      perks: PLANS[toPlan],
      billingCycle: cycle,
      price: result.price,
      grantedSignupBonus: result.grantedSignupBonus,
      currentPeriodEnd: result.periodEnd,
      paymentPlaceholder: true,
    })
  } catch (error) {
    console.error("[v0] subscription/upgrade error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
