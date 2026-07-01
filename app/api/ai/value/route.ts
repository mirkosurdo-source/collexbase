import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { identifyObject, gradeCondition, estimateValue, AIError } from "@/lib/ai-valuation"

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Autenticazione richiesta." }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    let identification = body.identification
    let grading = body.grading ?? null
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : ""
    const userValue = typeof body.userValue === "number" ? body.userValue : null

    // If only an image was supplied, derive identification + grading first.
    if (!identification && imageUrl) {
      identification = await identifyObject(imageUrl, body.category)
      grading = await gradeCondition(imageUrl)
    }

    if (!identification) {
      return NextResponse.json(
        { success: false, message: "Fornisci 'identification' oppure 'imageUrl'." },
        { status: 400 },
      )
    }

    const value = await estimateValue({ identification, grading, userValue })
    return NextResponse.json({ success: true, value, identification, grading })
  } catch (error) {
    if (error instanceof AIError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status })
    }
    console.error("[v0] ai/value error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
