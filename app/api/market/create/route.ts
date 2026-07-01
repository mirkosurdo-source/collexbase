import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Listing from "@/lib/models/Listing"
import User from "@/lib/models/User"
import { getAuthUserId } from "@/lib/auth/request"
import { getOrCreateWallet } from "@/lib/wallet"
import { suggestPrice } from "@/lib/ai-advisor"

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    const body = await req.json()
    const {
      itemName,
      description = "",
      category = "",
      condition = "",
      rarity = "Comune",
      year = null,
      value = 0,
      image = "",
      photos = [],
      price,
      acceptsTrade = false,
      acceptsItemPlusCash = false,
      acceptsItemPlusCoins = false,
    } = body

    if (!itemName || typeof itemName !== "string") {
      return NextResponse.json({ success: false, message: "Il nome dell'oggetto è obbligatorio." }, { status: 400 })
    }
    const numericPrice = Number(price)
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      return NextResponse.json({ success: false, message: "Inserisci un prezzo valido." }, { status: 400 })
    }

    await connectDB()
    const [user, wallet] = await Promise.all([User.findById(userId).select("username"), getOrCreateWallet(userId)])

    const ai = suggestPrice({ value: Number(value) || numericPrice, category, condition, rarity, year })

    const listing = await Listing.create({
      sellerId: userId,
      sellerUsername: user?.username || "utente",
      sellerBadge: wallet.badge,
      itemName: itemName.trim(),
      description,
      category,
      condition,
      rarity,
      year: typeof year === "number" ? year : null,
      value: Number(value) || 0,
      image,
      photos: Array.isArray(photos) ? photos.slice(0, 8) : [],
      price: numericPrice,
      aiSuggestedPrice: ai.suggested,
      acceptsTrade: Boolean(acceptsTrade),
      acceptsItemPlusCash: Boolean(acceptsItemPlusCash),
      acceptsItemPlusCoins: Boolean(acceptsItemPlusCoins),
    })

    return NextResponse.json({ success: true, message: "Annuncio pubblicato.", listing })
  } catch (error) {
    console.error("[v0] market/create error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
