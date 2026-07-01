import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { submitApplication } from "@/lib/creator-applications"

// POST /api/creator/apply — submit a Creator Partner application.
// Body: { instagramUrl?, tiktokUrl?, followerCountInstagram?, followerCountTikTok?, message? }
export async function POST(req: Request) {
  const userId = getAuthUserId(req)
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Autenticazione richiesta." }, { status: 401 })
  }

  let body: {
    instagramUrl?: string
    tiktokUrl?: string
    followerCountInstagram?: number | null
    followerCountTikTok?: number | null
    message?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Richiesta non valida." }, { status: 400 })
  }

  const result = await submitApplication({
    userId,
    instagramUrl: body.instagramUrl,
    tiktokUrl: body.tiktokUrl,
    followerCountInstagram: body.followerCountInstagram ?? null,
    followerCountTikTok: body.followerCountTikTok ?? null,
    message: body.message,
  })

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
  }
  return NextResponse.json(result)
}
