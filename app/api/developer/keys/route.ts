import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { listApiKeys, createApiKey, API_SCOPES } from "@/lib/api-keys"

// GET /api/developer/keys — list the current user's API keys.
export async function GET(req: Request) {
  const userId = getAuthUserId(req)
  if (!userId) return NextResponse.json({ success: false, message: "Non autorizzato." }, { status: 401 })
  try {
    const keys = await listApiKeys(userId)
    return NextResponse.json({ success: true, keys })
  } catch (err) {
    console.error("[v0] developer/keys GET error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}

// POST /api/developer/keys — create a new API key. Returns the raw key ONCE.
export async function POST(req: Request) {
  const userId = getAuthUserId(req)
  if (!userId) return NextResponse.json({ success: false, message: "Non autorizzato." }, { status: 401 })
  try {
    const body = (await req.json().catch(() => ({}))) as { label?: string; scopes?: string[] }
    const scopes = Array.isArray(body.scopes)
      ? body.scopes.filter((s) => (API_SCOPES as readonly string[]).includes(s))
      : []
    if (scopes.length === 0) {
      return NextResponse.json({ success: false, message: "Seleziona almeno uno scope." }, { status: 400 })
    }
    const created = await createApiKey(userId, body.label || "API key", scopes)
    return NextResponse.json({ success: true, key: created }, { status: 201 })
  } catch (err) {
    console.error("[v0] developer/keys POST error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
