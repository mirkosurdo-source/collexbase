import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import PaymentEscrow from "@/lib/models/PaymentEscrow"
import { connectDB } from "@/lib/db"

/** Lists escrows where the user is buyer or seller (active first). */
export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ error: "Non autenticato." }, { status: 401 })

    await connectDB()
    const escrows = await PaymentEscrow.find({
      $or: [{ buyerId: userId }, { sellerId: userId }],
      status: { $ne: "awaiting_payment" },
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()

    return NextResponse.json({
      escrows: escrows.map((e) => ({
        id: String(e._id),
        itemName: e.itemName,
        role: String(e.buyerId) === userId ? "buyer" : "seller",
        amount: e.amount,
        buyerFee: e.buyerFee,
        sellerFee: e.sellerFee,
        buyerTotal: e.buyerTotal,
        sellerNet: e.sellerNet,
        status: e.status,
        disputeReason: e.disputeReason,
        createdAt: e.createdAt,
        releasedAt: e.releasedAt,
      })),
    })
  } catch (err) {
    console.error("[v0] escrows list error:", err)
    return NextResponse.json({ error: "Errore nel caricamento degli escrow." }, { status: 500 })
  }
}
