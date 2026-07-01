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
    const id = (searchParams.get("id") || "").trim()
    if (!username || !id) {
      return NextResponse.json({ success: false, message: "Parametri mancanti." }, { status: 400 })
    }

    await connectDB()

    const user = await User.findOne({ username }).select("-password")
    if (!user) {
      return NextResponse.json({ success: false, message: "Utente non trovato." }, { status: 404 })
    }

    const wallet = await Wallet.findOne({ userId: user._id })
    const visibility = wallet?.itemsVisibility ?? "public"
    const viewerId = getAuthUserId(req)
    const isOwner = viewerId === String(user._id)
    if (visibility !== "public" && !isOwner) {
      return NextResponse.json({ success: false, message: "Collezione privata." }, { status: 403 })
    }

    const raw = (await CollectionItem.findOne({ _id: id, userId: user._id }).lean()) as RawItem | null
    if (!raw) {
      return NextResponse.json({ success: false, message: "Oggetto non trovato." }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      owner: { name: user.name, username: user.username },
      item: normalizeItem(raw),
    })
  } catch (error) {
    console.error("[v0] Errore public-item:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
