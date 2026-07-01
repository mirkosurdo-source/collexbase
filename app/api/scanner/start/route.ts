import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { connectDB } from "@/lib/db"
import ScanJob from "@/lib/models/ScanJob"
import { analyzeScan, type ScanResultData } from "@/lib/scanner-advanced"
import {
  countScansToday,
  validateImages,
  uploadScanImages,
  MAX_SCANS_PER_DAY,
} from "@/lib/scanner-jobs"
import { AIError } from "@/lib/ai-valuation"

// Multi-image vision analysis can be slow; allow generous time.
export const maxDuration = 300

/**
 * Blocco 40 — POST /api/scanner/start
 *
 * Accepts a multipart upload of up to 6 photos (field `images`, repeated) plus
 * an optional `category`. Enforces the daily limit, validates + uploads the
 * images to Blob, creates a ScanJob, runs the advanced analysis inline (no
 * background workers on serverless) and stores the result. Returns the jobId
 * and the completed result so the client can render immediately.
 */
export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Autenticazione richiesta." }, { status: 401 })
    }

    const contentType = req.headers.get("content-type") || ""
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { success: false, message: "Invia le immagini come multipart/form-data." },
        { status: 400 },
      )
    }

    // Daily anti-abuse limit.
    const used = await countScansToday(userId)
    if (used >= MAX_SCANS_PER_DAY) {
      return NextResponse.json(
        { success: false, message: `Limite giornaliero raggiunto (${MAX_SCANS_PER_DAY} scansioni).` },
        { status: 429 },
      )
    }

    const form = await req.formData()
    const files = form.getAll("images").filter((f): f is File => f instanceof File)
    const category = (form.get("category") as string) || "carte"

    const validation = validateImages(files)
    if (validation.error) {
      return NextResponse.json({ success: false, message: validation.error }, { status: validation.status })
    }

    // Upload images, then create the job in "processing".
    const imageUrls = await uploadScanImages(userId, validation.files)
    await connectDB()
    const job = await ScanJob.create({
      userId,
      status: "processing",
      images: imageUrls,
      category,
    })

    // Inline analysis (serverless has no background workers).
    try {
      const result: ScanResultData = await analyzeScan(imageUrls, category)
      job.result = result
      job.status = "completed"
      job.completedAt = new Date()
      await job.save()
      return NextResponse.json({ success: true, jobId: String(job._id), status: "completed", result })
    } catch (error) {
      job.status = "failed"
      job.error = error instanceof AIError ? error.message : "Analisi non riuscita."
      await job.save()
      const status = error instanceof AIError ? error.status : 502
      return NextResponse.json({ success: false, jobId: String(job._id), message: job.error }, { status })
    }
  } catch (error) {
    console.error("[v0] scanner/start error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
