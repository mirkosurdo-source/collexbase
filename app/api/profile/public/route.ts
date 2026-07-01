import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import CollectionItem from "@/lib/models/Collection"
import Wallet from "@/lib/models/Wallet"
import { getAuthUserId } from "@/lib/auth/request"
import { normalizeItem, type RawItem } from "@/lib/collection-helpers"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const username = (searchParams.get("username") || "").trim()
    if (!username) {
      return NextResponse.json({ success: false, message: "Username mancante." }, { status: 400 })
    }

    await connectDB()

    const user = await User.findOne({ username }).select("-password")
    if (!user) {
      return NextResponse.json({ success: false, message: "Utente non trovato." }, { status: 404 })
    }

    const wallet = await Wallet.findOne({ userId: user._id })
    const badge = wallet?.badge ?? "Base"
    const visibility = wallet?.itemsVisibility ?? "public"

    const viewerId = getAuthUserId(req)
    const isOwner = viewerId === String(user._id)
    const canView = visibility === "public" || isOwner

    const profile = {
      id: String(user._id),
      name: user.name,
      username: user.username,
      bio: user.bio || "",
      avatar: user.avatar || "",
      badge,
      isOwner,
    }

    if (!canView) {
      const totalItems = await CollectionItem.countDocuments({ userId: user._id })
      return NextResponse.json({ success: true, profile, hidden: true, totalItems, totalValue: null, categories: [] })
    }

    const items = (await CollectionItem.find({ userId: user._id }).sort({ createdAt: -1 }).lean()) as RawItem[]

    const map = new Map<string, { category: string; count: number; value: number; preview: ReturnType<typeof normalizeItem>[] }>()
    let totalValue = 0
    for (const raw of items) {
      const item = normalizeItem(raw)
      totalValue += item.currentValue
      const key = item.category
      if (!map.has(key)) map.set(key, { category: key, count: 0, value: 0, preview: [] })
      const bucket = map.get(key)!
      bucket.count += 1
      bucket.value += item.currentValue
      if (bucket.preview.length < 6) bucket.preview.push(item)
    }

    const categories = Array.from(map.values()).sort((a, b) => b.count - a.count)

    return NextResponse.json({
      success: true,
      profile,
      hidden: false,
      totalItems: items.length,
      totalValue,
      categories,
    })
  } catch (error) {
    console.error("[v0] Errore profilo pubblico:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
