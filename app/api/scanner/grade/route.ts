import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { connectDB } from "@/lib/db"
import ScanJob from "@/lib/models/ScanJob"
import { recomputeGrading, type ScanResultData } from "@/lib/scanner-advanced"

/**
 * Blocco 40 — POST /api/scanner/grade  { jobId }
 *
 * Recomputes the overall grade + PSA-tier market values from the stored
 * analysis WITHOUT a new AI call (deterministic). Useful after the scoring
 * formula evolves or for an explicit "ricalcola" action. Scoped to the owner.
 */
export async function POST(req: Request) {
  const userId = getAuthUserId(req)
  if (!userId) {
    return NextResponse.json({ success: false, message: "Autenticazione richiesta." }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const jobId = typeof body.jobId === "string" ? body.jobId : ""
  if (!jobId) {
    return NextResponse.json({ success: false, message: "jobId mancante." }, { status: 400 })
  }

  await connectDB()
  const job = await ScanJob.findById(jobId)
  if (!job || String(job.userId) !== userId) {
    return NextResponse.json({ success: false, message: "Scansione non trovata." }, { status: 404 })
  }
  if (job.status !== "completed" || !job.result) {
    return NextResponse.json({ success: false, message: "Scansione non completata." }, { status: 400 })
  }

  const recomputed = recomputeGrading(job.result.toObject() as ScanResultData)
  job.result = recomputed
  await job.save()

  return NextResponse.json({ success: true, jobId, result: recomputed })
}
