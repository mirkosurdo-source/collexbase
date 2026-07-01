import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"

/**
 * Real-time transport negotiation endpoint.
 *
 * The CollexBase deployment target (Vercel serverless functions) cannot hold a
 * persistent WebSocket upgrade on a standard route handler. Rather than fake a
 * socket, this endpoint validates the JWT and tells the client which transport
 * to use. When a dedicated WS gateway is configured via `CHAT_WS_URL`, its URL
 * is returned so the client can connect directly; otherwise the client uses the
 * documented incremental polling fallback (`?since=` on the thread/threads
 * endpoints). Events emitted over either transport: `message:new`,
 * `message:read`, `thread:update`.
 */
export async function GET(req: Request) {
  // JWT may be passed via Authorization header or `?token=` query param.
  let userId = getAuthUserId(req)
  if (!userId) {
    const token = new URL(req.url).searchParams.get("token")
    if (token) {
      const { verifyToken } = await import("@/lib/auth/jwt")
      userId = verifyToken(token)?.userId ?? null
    }
  }

  if (!userId) {
    return NextResponse.json({ success: false, message: "Autenticazione richiesta." }, { status: 401 })
  }

  const wsUrl = process.env.CHAT_WS_URL || null

  if (req.headers.get("upgrade")?.toLowerCase() === "websocket" && !wsUrl) {
    // Signal that an upgrade is not available here; use polling instead.
    return new NextResponse("WebSocket non disponibile su questo endpoint. Usa il polling.", { status: 426 })
  }

  return NextResponse.json({
    success: true,
    transport: wsUrl ? "websocket" : "polling",
    wsUrl,
    pollIntervalMs: 4000,
    events: ["message:new", "message:read", "thread:update"],
  })
}
