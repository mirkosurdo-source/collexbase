import { NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth/jwt"
import { createNotification, type NotificationType } from "@/lib/notifications"

function extractToken(req: Request, bodyToken?: string): string | null {
  const authHeader = req.headers.get("authorization")
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7)
  }
  return bodyToken || null
}

const VALID_TYPES: NotificationType[] = ["auction", "trade", "message", "system"]

export async function POST(req: Request) {
  try {
    let body: Record<string, unknown> = {}
    try {
      body = await req.json()
    } catch {
      body = {}
    }

    const token = extractToken(req, body?.token as string | undefined)
    if (!token) {
      return NextResponse.json({ success: false, message: "Token mancante." }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ success: false, message: "Token non valido o scaduto." }, { status: 401 })
    }

    const title = typeof body.title === "string" ? body.title.trim() : ""
    if (!title) {
      return NextResponse.json({ success: false, message: "Il titolo è obbligatorio." }, { status: 400 })
    }

    const type = (typeof body.type === "string" && VALID_TYPES.includes(body.type as NotificationType)
      ? body.type
      : "system") as NotificationType

    // A user may only create notifications addressed to themselves through this
    // public endpoint. Internal triggers use the createNotification helper directly.
    const targetUserId = typeof body.userId === "string" && body.userId ? body.userId : decoded.userId
    if (targetUserId !== decoded.userId) {
      return NextResponse.json(
        { success: false, message: "Non puoi creare notifiche per altri utenti." },
        { status: 403 },
      )
    }

    await createNotification({
      userId: decoded.userId,
      type,
      title,
      body: typeof body.body === "string" ? body.body : "",
      link: typeof body.link === "string" ? body.link : "",
    })

    return NextResponse.json({ success: true, message: "Notifica creata." })
  } catch (error) {
    console.error("[v0] Errore create notification:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
