import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Trade from "@/lib/models/Trade"
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

    await connectDB()

    const sent = await Trade.find({ fromUserId: decoded.userId }).sort({ updatedAt: -1 }).lean()
    const received = await Trade.find({ toUserId: decoded.userId }).sort({ updatedAt: -1 }).lean()

    return NextResponse.json({ success: true, sent, received, userId: decoded.userId })
  } catch (error) {
    console.error("[v0] Errore list trades:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
