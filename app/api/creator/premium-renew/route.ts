import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import {
  PLANS,
  applyPlanChange,
  getOrCreateSubState,
  planPrice,
  type BillingCycle,
  type PlanId,
} from "@/lib/subscription"
import { computeInvitedDiscount, recordCreatorCommission } from "@/lib/creator-affiliate"

/**
 * Discounted renewal for invited users (10% within the creator window).
 * Renews the user's current paid plan via the existing engine and accrues the
 * creator commission. Body: { billingCycle? }
 */
export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ ok: false, error: "Non autenticato." }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const state = await getOrCreateSubState(userId)
    const plan = state.plan as PlanId
    if (plan === "Base") {
      return NextResponse.json({ ok: false, error: "Nessun piano a pagamento da rinnovare." }, { status: 400 })
    }
    const cycle: BillingCycle = body.billingCycle === "yearly" ? "yearly" : (state.billingCycle as BillingCycle) || "monthly"

    const listPrice = planPrice(plan, cycle)
    const { discount, creatorId } = await computeInvitedDiscount(userId, { isRenewal: true })
    const finalPrice = Math.round(listPrice * (1 - discount) * 100) / 100

    const result = await applyPlanChange({ userId, toPlan: plan, cycle, event: "renew" })
    const commission = await recordCreatorCommission({
      userId,
      amountSpent: finalPrice,
      source: plan.toLowerCase(),
      discountApplied: Math.round((listPrice - finalPrice) * 100) / 100,
    })

    return NextResponse.json({
      ok: true,
      plan,
      billingCycle: cycle,
      listPrice,
      discount,
      finalPrice,
      currentPeriodEnd: result.periodEnd,
      perks: PLANS[plan],
      creatorId,
      commissionCredited: commission.credited,
      paymentPlaceholder: true,
    })
  } catch (error) {
    console.error("[v0] creator/premium-renew error:", error)
    return NextResponse.json({ ok: false, error: "Errore del server." }, { status: 500 })
  }
}
