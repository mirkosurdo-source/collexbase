import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { connectDB } from "@/lib/db"
import ScanJob from "@/lib/models/ScanJob"

/**
 * Blocco 40 — GET /api/scanner/status/[jobId]
 *
 * Lightweight status poll. Returns only the job status + image count, scoped to
 * the owner so one user can never read another user's jobs.
 */
export async function GET(req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const userId = getAuthUserId(req)
  if (!userId) {
    return NextResponse.json({ success: false, message: "Autenticazione richiesta." }, { status: 401 })
  }

  const { jobId } = await ctx.params
  await connectDB()
  const job = await ScanJob.findById(jobId).select("userId status images completedAt error").lean()
  if (!job || String((job as { userId: string }).userId) !== userId) {
    return NextResponse.json({ success: false, message: "Scansione non trovata." }, { status: 404 })
  }

  const j = job as { status: string; images: string[]; completedAt?: Date | null; error?: string }
  return NextResponse.json({
    success: true,
    status: j.status,
    imageCount: j.images.length,
    completedAt: j.completedAt ? new Date(j.completedAt).toISOString() : null,
    error: j.error || "",
  })
}
