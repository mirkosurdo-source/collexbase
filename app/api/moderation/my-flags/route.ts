import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import ModerationEvent from "@/lib/models/ModerationEvent"
import { getAuthUserId } from "@/lib/auth/request"

export const dynamic = "force-dynamic"

/**
 * Blocco 37 — returns the current user's own moderation flags so the app can
 * show banners ("contenuto rimosso", "annuncio segnalato", …). Read-only and
 * scoped strictly to the authenticated user.
 */
export async function GET(req: Request) {
  const userId = getAuthUserId(req)
  if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

  try {
    await connectDB()
    const url = new URL(req.url)
    const onlyOpen = url.searchParams.get("open") === "1"

    const filter: Record<string, unknown> = { userId }
    if (onlyOpen) filter.resolved = false

    const events = await ModerationEvent.find(filter)
      .select("targetType targetId severity category reason autoActioned resolved resolution createdAt")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()

    const flags = events.map((e) => ({
      id: String(e._id),
      targetType: e.targetType,
      targetId: e.targetId || "",
      severity: e.severity,
      category: e.category,
      reason: e.reason || "",
      autoActioned: Boolean(e.autoActioned),
      resolved: Boolean(e.resolved),
      resolution: e.resolution || null,
      createdAt: e.createdAt,
    }))

    return NextResponse.json({
      success: true,
      flags,
      openCount: flags.filter((f) => !f.resolved).length,
    })
  } catch (err) {
    console.error("[v0] moderation/my-flags GET error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
