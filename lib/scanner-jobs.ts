import { put } from "@vercel/blob"
import { connectDB } from "@/lib/db"
import ScanJob from "@/lib/models/ScanJob"

/**
 * Blocco 40 — anti-abuse + upload helpers for the advanced scanner.
 *
 * Centralises the daily-scan limit, image validation and Blob uploads so the
 * route stays thin. All limits are conservative and enforced server-side.
 */

export const MAX_SCANS_PER_DAY = 10
export const MAX_IMAGES = 6
const MAX_BYTES = 15 * 1024 * 1024 // 15MB per image
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"]

/** Counts completed/pending scans created by the user in the last 24h. */
export async function countScansToday(userId: string): Promise<number> {
  await connectDB()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  return ScanJob.countDocuments({ userId, createdAt: { $gte: since } })
}

export interface UploadValidation {
  files: File[]
  error?: string
  status?: number
}

/** Validates uploaded image files (count, type, size, duplicate bytes). */
export function validateImages(files: File[]): UploadValidation {
  if (files.length === 0) return { files: [], error: "Nessuna immagine fornita.", status: 400 }
  if (files.length > MAX_IMAGES) {
    return { files: [], error: `Massimo ${MAX_IMAGES} immagini per scansione.`, status: 400 }
  }
  const seen = new Set<string>()
  for (const file of files) {
    if (!ALLOWED.includes(file.type)) {
      return { files: [], error: "Formato immagine non supportato.", status: 400 }
    }
    if (file.size > MAX_BYTES) {
      return { files: [], error: "Immagine troppo grande (max 15MB).", status: 400 }
    }
    // Cheap duplicate guard: same type+size is very likely the same image.
    const sig = `${file.type}:${file.size}`
    if (seen.has(sig)) {
      return { files: [], error: "Immagini duplicate rilevate. Carica foto diverse.", status: 400 }
    }
    seen.add(sig)
  }
  return { files }
}

/** Uploads the validated images to Blob and returns their public URLs. */
export async function uploadScanImages(userId: string, files: File[]): Promise<string[]> {
  const urls: string[] = []
  for (const file of files) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "scan.jpg"
    const blob = await put(`scanner/${userId}/${Date.now()}-${safeName}`, file, {
      access: "public",
      addRandomSuffix: true,
    })
    urls.push(blob.url)
  }
  return urls
}
