import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Follow from "@/lib/models/Follow"
import User from "@/lib/models/User"
import { getAuthUserId } from "@/lib/auth/request"

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    const body = await req.json()
    const { sellerId } = body
    if (!sellerId) {
      return NextResponse.json({ success: false, message: "ID venditore mancante." }, { status: 400 })
    }
    if (sellerId === userId) {
      return NextResponse.json({ success: false, message: "Non puoi seguire te stesso." }, { status: 400 })
    }

    await connectDB()

    const existing = await Follow.findOne({ followerId: userId, sellerId })
    if (existing) {
      await existing.deleteOne()
      return NextResponse.json({ success: true, following: false, message: "Hai smesso di seguire il venditore." })
    }

    const seller = await User.findById(sellerId).select("username")
    await Follow.create({ followerId: userId, sellerId, sellerUsername: seller?.username || "" })
    return NextResponse.json({ success: true, following: true, message: "Ora segui questo venditore." })
  } catch (error) {
    console.error("[v0] market/follow error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
