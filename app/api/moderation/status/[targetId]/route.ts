import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import ModerationEvent from "@/lib/models/ModerationEvent"
import { getAuthUserId } from "@/lib/auth/request"

export const dynamic = "force-dynamic"

/**
 * Blocco 37 — returns the moderation status of a single target (post, listing,
 * trade, …). A user may only inspect targets they own; admins are handled by
 * the dedicated admin endpoints. Returns `{ moderated, hidden, … }`.
 */
export async function GET(req: Request, { params }: { params: Promise<{ targetId: string }> }) {
  const userId = getAuthUserId(req)
  if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

  try {
    const { targetId } = await params
    if (!targetId) return NextResponse.json({ success: false, message: "Target mancante." }, { status: 400 })

    await connectDB()
    const events = await ModerationEvent.find({ targetId, userId })
      .select("severity category reason autoActioned resolved resolution createdAt")
      .sort({ createdAt: -1 })
      .lean()

    const open = events.filter((e) => !e.resolved)
    const hidden = open.some((e) => e.autoActioned && e.resolution !== "resolved")
    const top = open[0] || events[0] || null

    return NextResponse.json({
      success: true,
      moderated: events.length > 0,
      hidden,
      openCount: open.length,
      status: top
        ? {
            severity: top.severity,
            category: top.category,
            reason: top.reason || "",
            resolved: Boolean(top.resolved),
            resolution: top.resolution || null,
            createdAt: top.createdAt,
          }
        : null,
    })
  } catch (err) {
    console.error("[v0] moderation/status GET error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
