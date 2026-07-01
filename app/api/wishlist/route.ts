import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import WishlistEntry from "@/lib/models/WishlistEntry"
import { getAuthUserId } from "@/lib/auth/request"

export const dynamic = "force-dynamic"

/**
 * Blocco 24 §2 — GET /api/wishlist
 * Returns the authenticated user's intelligent wishlist entries.
 */
export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Autenticazione richiesta." }, { status: 401 })
    }

    await connectDB()
    const entries = await WishlistEntry.find({ userId }).sort({ createdAt: -1 }).lean()

    const items = entries.map((e) => ({
      id: String(e._id),
      itemName: e.itemName,
      category: e.category || "",
      series: e.series ?? null,
      set: e.set ?? null,
      rarity: e.rarity ?? null,
      number: e.number ?? null,
      minCondition: e.minCondition ?? null,
      maxPrice: e.maxPrice ?? null,
      notifyEnabled: e.notifyEnabled !== false,
      createdAt: e.createdAt,
    }))

    return NextResponse.json({ success: true, items })
  } catch (error) {
    console.error("[v0] GET /api/wishlist error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
