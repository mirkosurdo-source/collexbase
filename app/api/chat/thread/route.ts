import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { resolveThread, serializeThread, type ChatType } from "@/lib/chat"

const TYPES: ChatType[] = ["private", "trade", "marketplace", "auction"]

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Autenticazione richiesta." }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const type = body.type as ChatType
    if (!TYPES.includes(type)) {
      return NextResponse.json({ success: false, message: "Tipo di chat non valido." }, { status: 400 })
    }

    const result = await resolveThread({
      type,
      requesterId: userId,
      targetUserId: body.targetUserId ? String(body.targetUserId) : undefined,
      contextId: body.contextId ? String(body.contextId) : undefined,
    })

    if ("error" in result) {
      return NextResponse.json({ success: false, message: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, thread: serializeThread(result.thread, userId) })
  } catch (error) {
    console.error("[v0] chat/thread error:", error)
    return NextResponse.json({ success: false, message: "Errore durante la creazione del thread." }, { status: 500 })
  }
}
