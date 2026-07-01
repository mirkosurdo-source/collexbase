import { put } from "@vercel/blob"

/**
 * Blocco 21 — resolves an image for the AI routes.
 *
 * Accepts either a multipart upload (field `file`, per the spec's "immagine
 * (Blob)") or a JSON body with `{ imageUrl }` (reuse an existing collection
 * image). Uploaded files are stored in Blob and the public URL is returned.
 */

const MAX_BYTES = 15 * 1024 * 1024 // 15MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"]

export interface ResolvedAIRequest {
  imageUrl: string
  category?: string
  objectId?: string
  userValue?: number | null
  error?: string
  status?: number
}

export async function resolveAIRequest(req: Request, userId: string): Promise<ResolvedAIRequest> {
  const contentType = req.headers.get("content-type") || ""

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData()
    const file = form.get("file") as File | null
    const category = (form.get("category") as string) || undefined
    const objectId = (form.get("objectId") as string) || undefined
    const userValueRaw = form.get("userValue") as string | null

    if (!file) return { imageUrl: "", error: "Nessuna immagine fornita.", status: 400 }
    if (!ALLOWED.includes(file.type)) return { imageUrl: "", error: "Formato immagine non supportato.", status: 400 }
    if (file.size > MAX_BYTES) return { imageUrl: "", error: "Immagine troppo grande (max 15MB).", status: 400 }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const blob = await put(`ai/${userId}/${Date.now()}-${safeName}`, file, {
      access: "public",
      addRandomSuffix: true,
    })
    return {
      imageUrl: blob.url,
      category,
      objectId,
      userValue: userValueRaw ? Number(userValueRaw) : null,
    }
  }

  // JSON body fallback.
  const body = await req.json().catch(() => ({}))
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : ""
  if (!imageUrl) return { imageUrl: "", error: "Immagine o imageUrl mancante.", status: 400 }
  return {
    imageUrl,
    category: typeof body.category === "string" ? body.category : undefined,
    objectId: typeof body.objectId === "string" ? body.objectId : undefined,
    userValue: typeof body.userValue === "number" ? body.userValue : null,
  }
}
