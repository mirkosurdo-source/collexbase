import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { revokeApiKey } from "@/lib/api-keys"

// DELETE /api/developer/keys/[id] — revoke one of the current user's keys.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = getAuthUserId(req)
  if (!userId) return NextResponse.json({ success: false, message: "Non autorizzato." }, { status: 401 })
  const { id } = await params
  try {
    const ok = await revokeApiKey(userId, id)
    if (!ok) return NextResponse.json({ success: false, message: "Chiave non trovata." }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[v0] developer/keys DELETE error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
