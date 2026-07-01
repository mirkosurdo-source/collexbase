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
    const { name, category = "", targetPrice = 0, note = "" } = body
    if (!name || typeof name !== "string") {
      return NextResponse.json({ success: false, message: "Il nome dell'oggetto è obbligatorio." }, { status: 400 })
    }

    await connectDB()
    let wishlist = await Wishlist.findOne({ userId })
    if (!wishlist) wishlist = await Wishlist.create({ userId, items: [] })

    wishlist.items.push({
      name: name.trim(),
      category,
      targetPrice: Number(targetPrice) || 0,
      note,
      createdAt: new Date(),
    })
    await wishlist.save()

    return NextResponse.json({ success: true, message: "Aggiunto alla wishlist.", wishlist })
  } catch (error) {
    console.error("[v0] wishlist/add error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
