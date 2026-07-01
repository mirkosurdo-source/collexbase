import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Escrow from "@/lib/models/Escrow"
import Shipment from "@/lib/models/Shipment"
import { getAuthUserId } from "@/lib/auth/request"
import { releasePayment } from "@/lib/escrow"

export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    await connectDB()

    // Auto-release any escrows whose 48h window has elapsed (best-effort).
    const matured = await Escrow.find({
      status: { $in: ["locked", "shipped"] },
      releaseAt: { $lte: new Date() },
      $or: [{ buyerId: userId }, { sellerId: userId }],
    })
      .select("_id")
      .lean()
    for (const m of matured) {
      await releasePayment(String((m as Record<string, unknown>)._id), userId).catch(() => {})
    }

    const escrows = await Escrow.find({ $or: [{ buyerId: userId }, { sellerId: userId }] })
      .sort({ createdAt: -1 })
      .lean()

    const shipmentIds = escrows
      .map((e: Record<string, unknown>) => e.shipmentId)
      .filter(Boolean)
    const shipments = shipmentIds.length ? await Shipment.find({ _id: { $in: shipmentIds } }).lean() : []
    const shipmentMap = new Map(shipments.map((s: Record<string, unknown>) => [String(s._id), s]))

    const items = escrows.map((e: Record<string, unknown>) => ({
      ...e,
      _id: String(e._id),
      role: String(e.buyerId) === userId ? "buyer" : "seller",
      shipment: e.shipmentId ? shipmentMap.get(String(e.shipmentId)) || null : null,
    }))

    return NextResponse.json({ success: true, escrows: items })
  } catch (error) {
    console.error("[v0] wallet/escrows error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
