import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { connectDB } from "@/lib/db"
import CollectionItem from "@/lib/models/Collection"
import { analyzeDuplicates, isRarityHigh } from "@/lib/ai-valuation"

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Autenticazione richiesta." }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    let name = typeof body.name === "string" ? body.name.trim() : ""
    const rarity = typeof body.rarity === "string" ? body.rarity : null

    await connectDB()

    // If an objectId is given, resolve its name (and ownership) first.
    if (!name && typeof body.objectId === "string") {
      const item = await CollectionItem.findById(body.objectId).select("name userId").lean<{ name: string; userId: string }>()
      if (item && String(item.userId) === String(userId)) name = item.name
    }

    if (!name) {
      return NextResponse.json({ success: false, message: "Nome oggetto mancante." }, { status: 400 })
    }

    // Count copies the user owns with a matching name (case-insensitive, exact-ish).
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const total = await CollectionItem.countDocuments({
      userId,
      name: { $regex: `^${escaped}$`, $options: "i" },
    })

    const duplicates = analyzeDuplicates(total || 1, isRarityHigh(rarity))
    return NextResponse.json({ success: true, duplicates })
  } catch (error) {
    console.error("[v0] ai/duplicates error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
