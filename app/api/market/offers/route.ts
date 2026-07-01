import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Offer from "@/lib/models/Offer"
import { getAuthUserId } from "@/lib/auth/request"

export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    await connectDB()

    const [received, sent] = await Promise.all([
      // Offers awaiting this user's response: buyer offers to me as seller, or
      // counteroffers sent by the seller to me as buyer.
      Offer.find({
        $or: [
          { sellerId: userId, fromSeller: false },
          { buyerId: userId, fromSeller: true },
        ],
      })
        .sort({ createdAt: -1 })
        .lean(),
      // Offers this user initiated.
      Offer.find({
        $or: [
          { buyerId: userId, fromSeller: false },
          { sellerId: userId, fromSeller: true },
        ],
      })
        .sort({ createdAt: -1 })
        .lean(),
    ])

    const normalize = (o: Record<string, unknown>) => ({ ...o, _id: String(o._id) })

    return NextResponse.json({
      success: true,
      received: received.map(normalize),
      sent: sent.map(normalize),
    })
  } catch (error) {
    console.error("[v0] market/offers error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
