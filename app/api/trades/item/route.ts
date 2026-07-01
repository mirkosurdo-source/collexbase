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

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    if (!id) {
      return NextResponse.json({ success: false, message: "ID mancante." }, { status: 400 })
    }

    await connectDB()

    const trade = await Trade.findById(id).lean()
    if (!trade) {
      return NextResponse.json({ success: false, message: "Scambio non trovato." }, { status: 404 })
    }

    const t = trade as Record<string, unknown>

    // Only participants can view the trade.
    if (t.fromUserId !== decoded.userId && t.toUserId !== decoded.userId) {
      return NextResponse.json({ success: false, message: "Accesso non autorizzato." }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      trade: t,
      userId: decoded.userId,
      isRecipient: t.toUserId === decoded.userId,
    })
  } catch (error) {
    console.error("[v0] Errore item trade:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
