import { type NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"
import { getAuthUserId } from "@/lib/auth/request"
import { connectDB } from "@/lib/db"
import ChatThread from "@/lib/models/ChatThread"

const MAX_BYTES = 20 * 1024 * 1024 // 20MB
const ALLOWED = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "application/zip",
]

export async function POST(req: NextRequest) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Autenticazione richiesta." }, { status: 401 })
    }

    const form = await req.formData()
    const file = form.get("file") as File | null
    const threadId = (form.get("threadId") as string) || ""

    if (!file) {
      return NextResponse.json({ success: false, message: "Nessun file fornito." }, { status: 400 })
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ success: false, message: "Formato file non supportato." }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ success: false, message: "File troppo grande (max 20MB)." }, { status: 400 })
    }

    // Verify thread access before accepting the upload.
    if (threadId) {
      await connectDB()
      const thread = await ChatThread.findById(threadId).select("participants").lean<{ participants: string[] }>()
      if (!thread || !thread.participants.includes(userId)) {
        return NextResponse.json({ success: false, message: "Accesso non autorizzato." }, { status: 403 })
      }
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const blob = await put(`chat/${threadId || userId}/${Date.now()}-${safeName}`, file, {
      access: "public",
      addRandomSuffix: true,
    })

    return NextResponse.json({
      success: true,
      attachment: {
        url: blob.url,
        name: file.name,
        contentType: file.type,
        size: file.size,
      },
    })
  } catch (error) {
    console.error("[v0] chat/upload error:", error)
    return NextResponse.json({ success: false, message: "Caricamento non riuscito." }, { status: 500 })
  }
}
