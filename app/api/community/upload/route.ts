import { type NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"
import { getAuthUserId } from "@/lib/auth/request"

const MAX_BYTES = 8 * 1024 * 1024 // 8MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"]

export async function POST(req: NextRequest) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Autenticazione richiesta." }, { status: 401 })
    }

    const form = await req.formData()
    const file = form.get("file") as File | null
    if (!file) {
      return NextResponse.json({ success: false, message: "Nessun file fornito." }, { status: 400 })
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ success: false, message: "Formato immagine non supportato." }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ success: false, message: "Immagine troppo grande (max 8MB)." }, { status: 400 })
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const blob = await put(`community/${userId}/${Date.now()}-${safeName}`, file, {
      access: "public",
      addRandomSuffix: true,
    })

    return NextResponse.json({ success: true, url: blob.url })
  } catch (error) {
    console.error("[v0] community/upload error:", error)
    return NextResponse.json({ success: false, message: "Caricamento non riuscito." }, { status: 500 })
  }
}
