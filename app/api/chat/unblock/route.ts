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
    if (!blockedId) {
      return NextResponse.json({ success: false, message: "Utente non valido." }, { status: 400 })
    }

    await connectDB()
    await ChatBlock.deleteOne({ blockerId: userId, blockedId })

    return NextResponse.json({ success: true, message: "Utente sbloccato." })
  } catch (error) {
    console.error("[v0] chat/unblock error:", error)
    return NextResponse.json({ success: false, message: "Errore durante lo sblocco." }, { status: 500 })
  }
}
