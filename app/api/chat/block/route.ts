import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { connectDB } from "@/lib/db"
import ChatBlock from "@/lib/models/ChatBlock"

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Autenticazione richiesta." }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const blockedId = body.targetUserId ? String(body.targetUserId) : ""
    if (!blockedId || blockedId === userId) {
      return NextResponse.json({ success: false, message: "Utente da bloccare non valido." }, { status: 400 })
    }

    await connectDB()
    await ChatBlock.updateOne(
      { blockerId: userId, blockedId },
      { $setOnInsert: { blockerId: userId, blockedId } },
      { upsert: true },
    )

    return NextResponse.json({ success: true, message: "Utente bloccato." })
  } catch (error) {
    console.error("[v0] chat/block error:", error)
    return NextResponse.json({ success: false, message: "Errore durante il blocco." }, { status: 500 })
  }
}
