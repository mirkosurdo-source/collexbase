import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { sendMessage, serializeMessage, type Attachment } from "@/lib/chat"

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Autenticazione richiesta." }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const threadId = body.threadId ? String(body.threadId) : ""
    if (!threadId) {
      return NextResponse.json({ success: false, message: "threadId richiesto." }, { status: 400 })
    }

    const attachments: Attachment[] = Array.isArray(body.attachments)
      ? body.attachments
          .filter((a: unknown) => a && typeof a === "object" && typeof (a as Attachment).url === "string")
          .slice(0, 10)
      : []

    const result = await sendMessage({
      threadId,
      senderId: userId,
      text: typeof body.text === "string" ? body.text : null,
      attachments,
    })

    if ("error" in result && result.error) {
      const err = result.error
      const status = err.includes("limite") || err.includes("velocemente") ? 429 : 400
      return NextResponse.json({ success: false, message: err }, { status })
    }

    return NextResponse.json({ success: true, message: serializeMessage(result.message) })
  } catch (error) {
    console.error("[v0] chat/send error:", error)
    return NextResponse.json({ success: false, message: "Errore durante l'invio del messaggio." }, { status: 500 })
  }
}
