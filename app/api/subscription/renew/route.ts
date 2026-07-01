import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import {
  PLANS,
  applyPlanChange,
  getOrCreateSubState,
  type BillingCycle,
  type PlanId,
} from "@/lib/subscription"

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const state = await getOrCreateSubState(userId)
    const plan = state.plan as PlanId
    // Allow switching cycle on renew, otherwise keep the current one.
    const cycle: BillingCycle =
      body.billingCycle === "yearly" ? "yearly" : body.billingCycle === "monthly" ? "monthly" : (state.billingCycle as BillingCycle)

    // Placeholder payment step (no Stripe in this block).
    const result = await applyPlanChange({ userId, toPlan: plan, cycle, event: "renew" })

    return NextResponse.json({
      success: true,
      message: plan === "Base" ? "Piano Base attivo." : `Abbonamento ${plan} rinnovato.`,
      plan,
      perks: PLANS[plan],
      billingCycle: cycle,
      price: result.price,
      currentPeriodEnd: result.periodEnd,
      paymentPlaceholder: true,
    })
  } catch (error) {
    console.error("[v0] subscription/renew error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
