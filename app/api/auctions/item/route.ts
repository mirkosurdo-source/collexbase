import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Auction from "@/lib/models/Auction"
import { verifyToken } from "@/lib/auth/jwt"

function extractToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization")
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7)
  }
  return null
}

export async function GET(req: Request) {
  try {
    const token = extractToken(req)
    if (!token) {
      return NextResponse.json({ success: false, message: "Token mancante." }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ success: false, message: "Token non valido o scaduto." }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    if (!id) {
      return NextResponse.json({ success: false, message: "ID mancante." }, { status: 400 })
    }

    await connectDB()

    const auction = await Auction.findById(id).lean()
    if (!auction) {
      return NextResponse.json({ success: false, message: "Asta non trovata." }, { status: 404 })
    }

    // Auto-close if expired.
    const a = auction as Record<string, unknown>
    if (a.status === "active" && new Date(a.endsAt as string) <= new Date()) {
      await Auction.findByIdAndUpdate(id, { $set: { status: "closed" } })
      a.status = "closed"
    }

    return NextResponse.json({
      success: true,
      auction: a,
      isOwner: a.userId === decoded.userId,
    })
  } catch (error) {
    console.error("[v0] Errore item auction:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
