import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { resolveAIRequest } from "@/lib/ai-request"
import { identifyObject, AIError } from "@/lib/ai-valuation"

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Autenticazione richiesta." }, { status: 401 })
    }

    const resolved = await resolveAIRequest(req, userId)
    if (resolved.error) {
      return NextResponse.json({ success: false, message: resolved.error }, { status: resolved.status || 400 })
    }

    const identification = await identifyObject(resolved.imageUrl, resolved.category)
    return NextResponse.json({ success: true, identification })
  } catch (error) {
    if (error instanceof AIError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status })
    }
    console.error("[v0] ai/identify error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
