import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Shipment from "@/lib/models/Shipment"
import { getAuthUserId } from "@/lib/auth/request"

// Simulated carrier progression based on time elapsed since creation.
const STAGES: { status: string; location: string; afterMs: number; ship: string }[] = [
  { status: "in_transit", location: "In transito", afterMs: 2 * 60 * 60 * 1000, ship: "In transito" },
  { status: "out_for_delivery", location: "In consegna", afterMs: 24 * 60 * 60 * 1000, ship: "In consegna" },
  { status: "delivered", location: "Consegnato", afterMs: 48 * 60 * 60 * 1000, ship: "Consegnato" },
]

export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const trackingNumber = searchParams.get("tracking")
    const escrowId = searchParams.get("escrowId")
    if (!trackingNumber && !escrowId) {
      return NextResponse.json({ success: false, message: "Tracking mancante." }, { status: 400 })
    }

    await connectDB()
    const shipment = trackingNumber
      ? await Shipment.findOne({ trackingNumber })
      : await Shipment.findOne({ escrowId })
    if (!shipment) {
      return NextResponse.json({ success: false, message: "Spedizione non trovata." }, { status: 404 })
    }
    if (String(shipment.buyerId) !== userId && String(shipment.sellerId) !== userId) {
      return NextResponse.json({ success: false, message: "Non autorizzato." }, { status: 403 })
    }

    // Advance the simulated status if enough time has elapsed.
    const elapsed = Date.now() - new Date(shipment.createdAt).getTime()
    let changed = false
    for (const stage of STAGES) {
      if (elapsed >= stage.afterMs && shipment.status !== stage.status) {
        const already = shipment.events.some((e: { status: string }) => e.status === stage.ship)
        if (!already) {
          shipment.events.push({ status: stage.ship, location: stage.location, timestamp: new Date() })
        }
        shipment.status = stage.status
        changed = true
      }
    }
    if (changed) await shipment.save()

    return NextResponse.json({ success: true, shipment })
  } catch (error) {
    console.error("[v0] shipping/track error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
