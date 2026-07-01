import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import WishlistEntry from "@/lib/models/WishlistEntry"
import { getAuthUserId } from "@/lib/auth/request"

export const dynamic = "force-dynamic"

/**
 * Blocco 24 §2 — DELETE /api/wishlist/[id]
 * Removes a wishlist entry, scoped to its owner.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Autenticazione richiesta." }, { status: 401 })
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json({ success: false, message: "ID mancante." }, { status: 400 })
    }

    await connectDB()
    const deleted = await WishlistEntry.findOneAndDelete({ _id: id, userId }).lean()
    if (!deleted) {
      return NextResponse.json({ success: false, message: "Oggetto non trovato." }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: "Rimosso dalla wishlist." })
  } catch (error) {
    console.error("[v0] DELETE /api/wishlist/[id] error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
