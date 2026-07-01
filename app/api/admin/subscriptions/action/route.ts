import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { connectDB } from "@/lib/db"
import {
  applyPlanChange,
  getOrCreateSubState,
  isPlanId,
  planRank,
  PLANS,
  type BillingCycle,
} from "@/lib/subscription"
import { ensureSignupBonus, recordTransaction } from "@/lib/collexcoin"

export const dynamic = "force-dynamic"

/**
 * Admin subscription actions (all reuse existing subscription/coin helpers so
 * the live systems stay the single source of truth):
 *  - set_plan       : manual upgrade/downgrade to Base/Gold/Premium
 *  - grant_bonus    : settle the one-time per-tier signup bonus
 *  - grant_daily    : manually credit the tier's daily Collex Coin amount
 *  - grant_monthly  : manually credit the tier's monthly Collex Coin amount
 */
export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    const body = await req.json()
    const action = String(body.action || "")
    const userId = String(body.userId || "")
    if (!userId) return NextResponse.json({ success: false, message: "userId mancante." }, { status: 400 })

    await connectDB()

    if (action === "set_plan") {
      const toPlan = String(body.plan || "")
      const cycle = (String(body.cycle || "monthly") === "yearly" ? "yearly" : "monthly") as BillingCycle
      if (!isPlanId(toPlan)) return NextResponse.json({ success: false, message: "Piano non valido." }, { status: 400 })

      const state = await getOrCreateSubState(userId)
      const event = planRank(toPlan) >= planRank(state.plan as never) ? "upgrade" : "downgrade"
      const result = await applyPlanChange({ userId, toPlan, cycle, event })
      return NextResponse.json({
        success: true,
        message: `Piano aggiornato a ${toPlan}.`,
        plan: toPlan,
        grantedSignupBonus: result.grantedSignupBonus,
      })
    }

    if (action === "grant_bonus") {
      const res = await ensureSignupBonus(userId)
      return NextResponse.json({
        success: true,
        granted: res.granted,
        message: res.granted > 0 ? `+${res.granted} Collex Coin di benvenuto.` : "Bonus già assegnato per questo piano.",
      })
    }

    if (action === "grant_daily" || action === "grant_monthly") {
      const state = await getOrCreateSubState(userId)
      const plan = state.plan as keyof typeof PLANS
      const amount = action === "grant_daily" ? PLANS[plan].dailyCoins : PLANS[plan].monthlyCoins
      const res = await recordTransaction({
        userId,
        amount,
        type: "manual_adjustment",
        description:
          action === "grant_daily"
            ? `Ricarica giornaliera manuale (${plan})`
            : `Ricarica mensile manuale (${plan})`,
      })
      return NextResponse.json({ success: true, granted: amount, balance: res.balance, message: `+${amount} Collex Coin accreditati.` })
    }

    return NextResponse.json({ success: false, message: "Azione non riconosciuta." }, { status: 400 })
  } catch (err) {
    console.error("[v0] admin/subscriptions/action error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
