import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { resolveAIRequest } from "@/lib/ai-request"
import { gradeCondition, AIError } from "@/lib/ai-valuation"

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

    const grading = await gradeCondition(resolved.imageUrl)
    return NextResponse.json({ success: true, grading })
  } catch (error) {
    if (error instanceof AIError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status })
    }
    console.error("[v0] ai/grade error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
