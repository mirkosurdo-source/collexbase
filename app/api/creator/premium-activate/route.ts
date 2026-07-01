import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import {
  PLANS,
  applyPlanChange,
  getOrCreateSubState,
  isPlanId,
  planPrice,
  planRank,
  type BillingCycle,
  type PlanId,
} from "@/lib/subscription"
import { computeInvitedDiscount, recordCreatorCommission } from "@/lib/creator-affiliate"

/**
 * Discounted premium/gold activation for users invited by a creator.
 * Additive wrapper: it reuses the existing subscription engine (applyPlanChange)
 * unchanged, applies the invited-user discount, and accrues the creator
 * commission as CreatorCredits. Body: { plan, billingCycle? }
 */
export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ ok: false, error: "Non autenticato." }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const toPlan = body.plan as PlanId
    const cycle: BillingCycle = body.billingCycle === "yearly" ? "yearly" : "monthly"
    if (!isPlanId(toPlan) || toPlan === "Base") {
      return NextResponse.json({ ok: false, error: "Piano non valido." }, { status: 400 })
    }

    const state = await getOrCreateSubState(userId)
    if (planRank(toPlan) <= planRank(state.plan as PlanId)) {
      return NextResponse.json({ ok: false, error: "Usa il downgrade per piani inferiori." }, { status: 400 })
    }

    const listPrice = planPrice(toPlan, cycle)
    const { discount, creatorId } = await computeInvitedDiscount(userId, { isRenewal: false })
    const finalPrice = Math.round(listPrice * (1 - discount) * 100) / 100

    // Existing engine, untouched (placeholder payment).
    const result = await applyPlanChange({ userId, toPlan, cycle, event: "upgrade" })

    // Accrue commission for the inviting creator on the discounted spend.
    const commission = await recordCreatorCommission({
      userId,
      amountSpent: finalPrice,
      source: toPlan.toLowerCase(),
      discountApplied: Math.round((listPrice - finalPrice) * 100) / 100,
    })

    return NextResponse.json({
      ok: true,
      plan: toPlan,
      billingCycle: cycle,
      listPrice,
      discount,
      finalPrice,
      grantedSignupBonus: result.grantedSignupBonus,
      currentPeriodEnd: result.periodEnd,
      perks: PLANS[toPlan],
      creatorId,
      commissionCredited: commission.credited,
      paymentPlaceholder: true,
    })
  } catch (error) {
    console.error("[v0] creator/premium-activate error:", error)
    return NextResponse.json({ ok: false, error: "Errore del server." }, { status: 500 })
  }
}
