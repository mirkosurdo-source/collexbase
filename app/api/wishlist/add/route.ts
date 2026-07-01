import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import WishlistEntry from "@/lib/models/WishlistEntry"
import { getAuthUserId } from "@/lib/auth/request"

export const dynamic = "force-dynamic"

function clean(v: unknown): string | null {
  if (typeof v !== "string") return null
  const t = v.trim()
  return t.length > 0 ? t : null
}

/**
 * Blocco 24 §2 — POST /api/wishlist/add
 * Adds a desired item. Validates required name and rejects duplicates
 * (same name + category for the same user).
 */
export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Autenticazione richiesta." }, { status: 401 })
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const itemName = clean(body.itemName)
    if (!itemName) {
      return NextResponse.json({ success: false, message: "Il nome dell'oggetto è obbligatorio." }, { status: 400 })
    }

    const category = clean(body.category) || ""
    const maxPriceRaw = body.maxPrice
    const maxPrice =
      typeof maxPriceRaw === "number" && Number.isFinite(maxPriceRaw) && maxPriceRaw > 0
        ? Math.round(maxPriceRaw)
        : null

    await connectDB()

    // Duplicate check: same item name + category (case-insensitive) for this user.
    const existing = await WishlistEntry.findOne({
      userId,
      category,
      itemName: new RegExp(`^${itemName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
    }).lean()
    if (existing) {
      return NextResponse.json(
        { success: false, message: "Questo oggetto è già nella tua wishlist." },
        { status: 409 },
      )
    }

    const created = await WishlistEntry.create({
      userId,
      itemName,
      category,
      series: clean(body.series),
      set: clean(body.set),
      rarity: clean(body.rarity),
      number: clean(body.number),
      minCondition: clean(body.minCondition),
      maxPrice,
      notifyEnabled: body.notifyEnabled === false ? false : true,
    })

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

    return NextResponse.json({ success: true, id: String(created._id), items }, { status: 201 })
  } catch (error) {
    console.error("[v0] POST /api/wishlist/add error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
