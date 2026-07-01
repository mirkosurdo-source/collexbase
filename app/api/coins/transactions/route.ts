import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { connectDB } from "@/lib/db"
import CollexCoinTransaction from "@/lib/models/CollexCoinTransaction"

export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, Number(searchParams.get("page")) || 1)
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20))
    const skip = (page - 1) * limit

    await connectDB()
    const [rows, total] = await Promise.all([
      CollexCoinTransaction.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      CollexCoinTransaction.countDocuments({ userId }),
    ])

    const transactions = rows.map((t) => ({
      id: String(t._id),
      amount: t.amount,
      type: t.type,
      description: t.description,
      balanceAfter: t.balanceAfter,
      createdAt: t.createdAt,
    }))

    return NextResponse.json({
      success: true,
      transactions,
      page,
      limit,
      total,
      hasMore: skip + transactions.length < total,
    })
  } catch (err) {
    console.error("[v0] coins/transactions error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
