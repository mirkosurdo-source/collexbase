import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Wishlist from "@/lib/models/Wishlist"
import { getAuthUserId } from "@/lib/auth/request"

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    const body = await req.json()
    const { itemId } = body
    if (!itemId) {
      return NextResponse.json({ success: false, message: "ID elemento mancante." }, { status: 400 })
    }

    await connectDB()
    const wishlist = await Wishlist.findOne({ userId })
    if (!wishlist) {
      return NextResponse.json({ success: false, message: "Wishlist non trovata." }, { status: 404 })
    }

    wishlist.items = wishlist.items.filter((it: { _id: { toString(): string } }) => it._id.toString() !== itemId)
    await wishlist.save()

    return NextResponse.json({ success: true, message: "Rimosso dalla wishlist.", wishlist })
  } catch (error) {
    console.error("[v0] wishlist/remove error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
