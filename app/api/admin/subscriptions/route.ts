import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import UserSubscriptionState from "@/lib/models/UserSubscriptionState"
import SubscriptionHistory from "@/lib/models/SubscriptionHistory"

export const dynamic = "force-dynamic"

/** Lists subscription states (optionally filtered by plan) or a user's history. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    await connectDB()
    const url = new URL(req.url)
    const historyFor = (url.searchParams.get("historyFor") || "").trim()

    if (historyFor) {
      const history = await SubscriptionHistory.find({ userId: historyFor }).sort({ createdAt: -1 }).limit(50).lean()
      return NextResponse.json({
        success: true,
        history: history.map((h) => ({
          id: String(h._id),
          event: h.event,
          fromPlan: h.fromPlan,
          toPlan: h.toPlan,
          billingCycle: h.billingCycle,
          amount: h.amount,
          note: h.note,
          createdAt: h.createdAt,
        })),
      })
    }

    const plan = url.searchParams.get("plan") || ""
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1)
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 20))
    const filter: Record<string, unknown> = {}
    if (plan === "Base" || plan === "Gold" || plan === "Premium") filter.plan = plan

    const total = await UserSubscriptionState.countDocuments(filter)
    const states = await UserSubscriptionState.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()

    const ids = states.map((s) => String(s.userId))
    const users = await User.find({ _id: { $in: ids } }).select("username email").lean()
    const userMap = new Map(users.map((u) => [String(u._id), u]))

    return NextResponse.json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      subscriptions: states.map((s) => ({
        userId: String(s.userId),
        username: userMap.get(String(s.userId))?.username || "—",
        email: userMap.get(String(s.userId))?.email || "",
        plan: s.plan,
        billingCycle: s.billingCycle,
        signupBonusClaimed: s.signupBonusClaimed,
        lastDailyCoinAt: s.lastDailyCoinAt,
        lastMonthlyCoinAt: s.lastMonthlyCoinAt,
        updatedAt: s.updatedAt,
      })),
    })
  } catch (err) {
    console.error("[v0] admin/subscriptions error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
