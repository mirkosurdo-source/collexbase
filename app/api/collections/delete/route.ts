import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import CollectionItem from "@/lib/models/Collection"
import { verifyToken } from "@/lib/auth/jwt"

function extractToken(req: Request, bodyToken?: string): string | null {
  const authHeader = req.headers.get("authorization")
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7)
  }
  return bodyToken || null
}

export async function POST(req: Request) {
  try {
    let body: Record<string, unknown> = {}
    try {
      body = await req.json()
    } catch {
      body = {}
    }

    const token = extractToken(req, body?.token as string | undefined)
    if (!token) {
      return NextResponse.json({ success: false, message: "Token mancante." }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ success: false, message: "Token non valido o scaduto." }, { status: 401 })
    }

    const id = typeof body.id === "string" ? body.id : ""
    if (!id) {
      return NextResponse.json({ success: false, message: "ID mancante." }, { status: 400 })
    }

    await connectDB()

    const existing = await CollectionItem.findById(id)
    if (!existing) {
      return NextResponse.json({ success: false, message: "Oggetto non trovato." }, { status: 404 })
    }

    if (String(existing.userId) !== String(decoded.userId)) {
      return NextResponse.json({ success: false, message: "Accesso non autorizzato." }, { status: 403 })
    }

    await CollectionItem.findByIdAndDelete(id)

    return NextResponse.json({ success: true, message: "Oggetto eliminato con successo." }, { status: 200 })
  } catch (error) {
    console.error("[v0] Errore delete collection:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
