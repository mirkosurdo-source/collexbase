import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import UserSubscriptionState from "@/lib/models/UserSubscriptionState"
import CollexCoinBalance from "@/lib/models/CollexCoinBalance"
import PaymentWallet from "@/lib/models/PaymentWallet"

export const dynamic = "force-dynamic"

/** Admin user directory with search, role/status filters, and pagination. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    await connectDB()
    const url = new URL(req.url)
    const q = (url.searchParams.get("q") || "").trim()
    const role = url.searchParams.get("role") || ""
    const status = url.searchParams.get("status") || ""
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1)
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 20))

    const filter: Record<string, unknown> = {}
    if (q) {
      filter.$or = [
        { username: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { name: { $regex: q, $options: "i" } },
      ]
    }
    if (role === "admin" || role === "user") filter.role = role
    if (status === "blocked") filter.blocked = true
    if (status === "active") filter.blocked = { $ne: true }

    const total = await User.countDocuments(filter)
    const users = await User.find(filter)
      .select("name username email avatar role blocked createdAt")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()

    const ids = users.map((u) => String(u._id))
    const [states, balances, wallets] = await Promise.all([
      UserSubscriptionState.find({ userId: { $in: ids } }).select("userId plan billingCycle").lean(),
      CollexCoinBalance.find({ userId: { $in: ids } }).select("userId balance").lean(),
      PaymentWallet.find({ userId: { $in: ids } }).select("userId available pending blocked").lean(),
    ])

    const stateMap = new Map(states.map((s) => [String(s.userId), s]))
    const balMap = new Map(balances.map((b) => [String(b.userId), b]))
    const walletMap = new Map(wallets.map((w) => [String(w.userId), w]))

    const rows = users.map((u) => {
      const id = String(u._id)
      const w = walletMap.get(id)
      return {
        id,
        name: u.name,
        username: u.username,
        email: u.email,
        avatar: u.avatar || "",
        role: u.role || "user",
        blocked: Boolean(u.blocked),
        createdAt: u.createdAt,
        plan: stateMap.get(id)?.plan || "Base",
        billingCycle: stateMap.get(id)?.billingCycle || "monthly",
        coins: balMap.get(id)?.balance || 0,
        walletAvailable: w?.available || 0,
        walletPending: w?.pending || 0,
        walletBlocked: w?.blocked || 0,
      }
    })

    return NextResponse.json({ success: true, users: rows, total, page, pages: Math.ceil(total / limit) })
  } catch (err) {
    console.error("[v0] admin/users error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
