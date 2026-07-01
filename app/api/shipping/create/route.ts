import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Escrow from "@/lib/models/Escrow"
import Shipment from "@/lib/models/Shipment"
import { getAuthUserId } from "@/lib/auth/request"
import { createNotification } from "@/lib/notifications"

function generateTracking(): string {
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase()
  return `CX${Date.now().toString().slice(-6)}${rand}`
}

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    const body = await req.json()
    const { escrowId, carrier = "CollexShip", insured = false, insuranceValue = 0 } = body
    if (!escrowId) {
      return NextResponse.json({ success: false, message: "ID deposito mancante." }, { status: 400 })
    }

    await connectDB()
    const escrow = await Escrow.findById(escrowId)
    if (!escrow) {
      return NextResponse.json({ success: false, message: "Deposito non trovato." }, { status: 404 })
    }
    if (String(escrow.sellerId) !== userId) {
      return NextResponse.json({ success: false, message: "Solo il venditore può creare la spedizione." }, { status: 403 })
    }
    if (escrow.shipmentId) {
      return NextResponse.json({ success: false, message: "Spedizione già creata." }, { status: 400 })
    }

    const trackingNumber = generateTracking()
    const estimatedDelivery = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)

    const shipment = await Shipment.create({
      escrowId: escrow._id,
      sellerId: escrow.sellerId,
      buyerId: escrow.buyerId,
      carrier,
      trackingNumber,
      insured: Boolean(insured),
      insuranceValue: Boolean(insured) ? Number(insuranceValue) || escrow.price : 0,
      status: "created",
      events: [{ status: "Spedizione creata", location: "Centro smistamento", timestamp: new Date() }],
      estimatedDelivery,
    })

    escrow.status = "shipped"
    escrow.shipmentId = shipment._id
    await escrow.save()

    await createNotification({
      userId: String(escrow.buyerId),
      type: "system",
      title: "Oggetto spedito",
      body: `"${escrow.listingName}" è stato spedito. Tracking: ${trackingNumber}.`,
      link: "/wallet/transactions",
    })

    return NextResponse.json({ success: true, message: "Spedizione creata.", shipment })
  } catch (error) {
    console.error("[v0] shipping/create error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
