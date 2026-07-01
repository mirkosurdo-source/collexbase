import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import UserSubscriptionState from "@/lib/models/UserSubscriptionState"
import CollexCoinBalance from "@/lib/models/CollexCoinBalance"
import CollexCoinTransaction from "@/lib/models/CollexCoinTransaction"
import PaymentWallet from "@/lib/models/PaymentWallet"
import PaymentTransaction from "@/lib/models/PaymentTransaction"

export const dynamic = "force-dynamic"

/** Full admin view of a single user: profile, balances, and recent ledgers. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    await connectDB()
    const userId = (new URL(req.url).searchParams.get("userId") || "").trim()
    if (!userId) return NextResponse.json({ success: false, message: "userId mancante." }, { status: 400 })

    const user = await User.findById(userId).select("-password").lean()
    if (!user) return NextResponse.json({ success: false, message: "Utente non trovato." }, { status: 404 })

    const [state, balance, wallet, coinTx, payTx] = await Promise.all([
      UserSubscriptionState.findOne({ userId }).lean(),
      CollexCoinBalance.findOne({ userId }).lean(),
      PaymentWallet.findOne({ userId }).lean(),
      CollexCoinTransaction.find({ userId }).sort({ createdAt: -1 }).limit(25).lean(),
      PaymentTransaction.find({ userId }).sort({ createdAt: -1 }).limit(25).lean(),
    ])

    const u = user as Record<string, unknown>
    return NextResponse.json({
      success: true,
      user: {
        id: String(u._id),
        name: u.name,
        username: u.username,
        email: u.email,
        avatar: u.avatar || "",
        role: u.role || "user",
        blocked: Boolean(u.blocked),
        createdAt: u.createdAt,
      },
      subscription: state ? { plan: state.plan, billingCycle: state.billingCycle } : { plan: "Base", billingCycle: "monthly" },
      coins: balance?.balance || 0,
      wallet: wallet
        ? { available: wallet.available, pending: wallet.pending, blocked: wallet.blocked }
        : { available: 0, pending: 0, blocked: 0 },
      coinTransactions: coinTx.map((t) => ({
        id: String(t._id),
        amount: t.amount,
        type: t.type,
        description: t.description,
        balanceAfter: t.balanceAfter,
        createdAt: t.createdAt,
      })),
      paymentTransactions: payTx.map((t) => ({
        id: String(t._id),
        amount: t.amount,
        kind: t.kind,
        status: t.status,
        description: t.description,
        createdAt: t.createdAt,
      })),
    })
  } catch (err) {
    console.error("[v0] admin/users/detail error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
