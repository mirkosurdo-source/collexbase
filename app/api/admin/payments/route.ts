import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import PaymentWallet from "@/lib/models/PaymentWallet"
import PaymentEscrow from "@/lib/models/PaymentEscrow"
import PaymentTransaction from "@/lib/models/PaymentTransaction"

export const dynamic = "force-dynamic"

async function usernameMap(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))]
  const users = await User.find({ _id: { $in: unique } }).select("username").lean()
  return new Map(users.map((u) => [String(u._id), u.username]))
}

/**
 * Real-money admin views, selected by `?view=`:
 *  - wallets       : per-user available/pending/blocked balances
 *  - escrows       : escrow records (filterable by status)
 *  - transactions  : the global EUR ledger
 */
export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    await connectDB()
    const url = new URL(req.url)
    const view = url.searchParams.get("view") || "escrows"
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1)
    const limit = 20

    if (view === "wallets") {
      const total = await PaymentWallet.countDocuments({})
      const wallets = await PaymentWallet.find({})
        .sort({ available: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
      const map = await usernameMap(wallets.map((w) => String(w.userId)))
      return NextResponse.json({
        success: true,
        total,
        page,
        pages: Math.ceil(total / limit),
        wallets: wallets.map((w) => ({
          userId: String(w.userId),
          username: map.get(String(w.userId)) || "—",
          available: w.available,
          pending: w.pending,
          blocked: w.blocked,
        })),
      })
    }

    if (view === "transactions") {
      const kind = url.searchParams.get("kind") || ""
      const filter: Record<string, unknown> = {}
      if (kind) filter.kind = kind
      const total = await PaymentTransaction.countDocuments(filter)
      const txs = await PaymentTransaction.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
      const map = await usernameMap(txs.map((t) => String(t.userId)))
      return NextResponse.json({
        success: true,
        total,
        page,
        pages: Math.ceil(total / limit),
        transactions: txs.map((t) => ({
          id: String(t._id),
          username: map.get(String(t.userId)) || "—",
          kind: t.kind,
          amount: t.amount,
          status: t.status,
          description: t.description,
          createdAt: t.createdAt,
        })),
      })
    }

    // Default: escrows.
    const status = url.searchParams.get("status") || ""
    const filter: Record<string, unknown> = {}
    if (status) filter.status = status
    const total = await PaymentEscrow.countDocuments(filter)
    const escrows = await PaymentEscrow.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
    const map = await usernameMap([
      ...escrows.map((e) => String(e.buyerId)),
      ...escrows.map((e) => String(e.sellerId)),
    ])
    return NextResponse.json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      escrows: escrows.map((e) => ({
        id: String(e._id),
        itemName: e.itemName,
        buyer: map.get(String(e.buyerId)) || "—",
        seller: map.get(String(e.sellerId)) || "—",
        amount: e.amount,
        buyerFee: e.buyerFee,
        sellerFee: e.sellerFee,
        buyerTotal: e.buyerTotal,
        sellerNet: e.sellerNet,
        status: e.status,
        disputeReason: e.disputeReason || "",
        createdAt: e.createdAt,
      })),
    })
  } catch (err) {
    console.error("[v0] admin/payments error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
