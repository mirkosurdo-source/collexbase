import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { connectDB } from "@/lib/db"
import ScanJob from "@/lib/models/ScanJob"

/**
 * Blocco 40 — GET /api/scanner/result/[jobId]
 *
 * Returns the full stored analysis for a completed job, scoped to the owner.
 */
export async function GET(req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const userId = getAuthUserId(req)
  if (!userId) {
    return NextResponse.json({ success: false, message: "Autenticazione richiesta." }, { status: 401 })
  }

  const { jobId } = await ctx.params
  await connectDB()
  const job = await ScanJob.findById(jobId).lean()
  if (!job || String((job as { userId: string }).userId) !== userId) {
    return NextResponse.json({ success: false, message: "Scansione non trovata." }, { status: 404 })
  }

  const j = job as {
    _id: unknown
    status: string
    images: string[]
    category: string
    result: unknown
    error?: string
    completedAt?: Date | null
    createdAt?: Date
  }
  return NextResponse.json({
    success: true,
    job: {
      id: String(j._id),
      status: j.status,
      images: j.images,
      category: j.category,
      result: j.result,
      error: j.error || "",
      completedAt: j.completedAt ? new Date(j.completedAt).toISOString() : null,
      createdAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
    },
  })
}
