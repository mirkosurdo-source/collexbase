import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { connectDB } from "@/lib/db"
import Listing from "@/lib/models/Listing"

export const dynamic = "force-dynamic"

const ALLOWED = ["active", "pending", "sold", "cancelled"] as const

/** Admin listing moderation: force a listing status. */
export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    const body = await req.json()
    const listingId = String(body.listingId || "")
    const status = String(body.status || "")
    if (!listingId) return NextResponse.json({ success: false, message: "listingId mancante." }, { status: 400 })
    if (!ALLOWED.includes(status as never)) {
      return NextResponse.json({ success: false, message: "Stato non valido." }, { status: 400 })
    }

    await connectDB()
    const listing = await Listing.findByIdAndUpdate(listingId, { status }, { new: true }).select("status")
    if (!listing) return NextResponse.json({ success: false, message: "Annuncio non trovato." }, { status: 404 })

    return NextResponse.json({ success: true, status: listing.status, message: "Annuncio aggiornato." })
  } catch (err) {
    console.error("[v0] admin/marketplace/action error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
