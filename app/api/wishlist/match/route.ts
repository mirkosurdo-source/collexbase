import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import WishlistEntry from "@/lib/models/WishlistEntry"
import { getAuthUserId } from "@/lib/auth/request"

export const dynamic = "force-dynamic"

const KIND_LABELS: Record<string, string> = {
  marketplace: "Nella tua wishlist",
  auction: "Wishlist · in asta",
  trade: "Wishlist · in scambio",
}

/**
 * Blocco 24 §6/§7/§8 — POST /api/wishlist/match
 * Lightweight check used by listing/auction/trade pages to show a
 * "Wishlist Match" badge. Returns whether the given item matches any of the
 * authenticated user's wishlist entries (by name + optional category), with a
 * label and human reasons (e.g. below target price).
 */
export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    // Not authenticated → simply no match (badge hidden), never an error.
    if (!userId) return NextResponse.json({ matched: false })

    const body = (await req.json().catch(() => ({}))) as {
      kind?: string
      name?: string
      category?: string
      price?: number
      rarity?: string
    }
    const name = (body.name || "").trim()
    if (!name) return NextResponse.json({ matched: false })

    await connectDB()
    const entries = await WishlistEntry.find({ userId }).lean()

    const lowerName = name.toLowerCase()
    const category = (body.category || "").trim().toLowerCase()
    const matched = entries.find((e) => {
      const term = (e.itemName || "").toLowerCase()
      if (!term) return false
      const nameHit = lowerName.includes(term) || term.includes(lowerName)
      if (!nameHit) return false
      if (e.category && category && e.category.toLowerCase() !== category) return false
      return true
    })

    if (!matched) return NextResponse.json({ matched: false })

    const reasons: string[] = ["Questo oggetto è nella tua wishlist."]
    if (typeof body.price === "number" && matched.maxPrice != null) {
      if (body.price <= matched.maxPrice) {
        reasons.push(`Prezzo entro il tuo obiettivo di € ${matched.maxPrice.toLocaleString("it-IT")}.`)
      } else {
        reasons.push(`Sopra il tuo prezzo obiettivo (€ ${matched.maxPrice.toLocaleString("it-IT")}).`)
      }
    }

    return NextResponse.json({
      matched: true,
      label: KIND_LABELS[body.kind || "marketplace"] || "Nella tua wishlist",
      reasons,
      entryId: String(matched._id),
    })
  } catch (error) {
    console.error("[v0] POST /api/wishlist/match error:", error)
    return NextResponse.json({ matched: false })
  }
}
