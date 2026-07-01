import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import CollectionItem from "@/lib/models/Collection"
import { verifyToken } from "@/lib/auth/jwt"

function extractToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization")
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7)
  }
  return null
}

export async function GET(req: Request) {
  try {
    const token = extractToken(req)
    if (!token) {
      return NextResponse.json({ success: false, message: "Token mancante." }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ success: false, message: "Token non valido o scaduto." }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    if (!id) {
      return NextResponse.json({ success: false, message: "ID mancante." }, { status: 400 })
    }

    await connectDB()

    const item = await CollectionItem.findById(id)
    if (!item) {
      return NextResponse.json({ success: false, message: "Oggetto non trovato." }, { status: 404 })
    }

    if (String(item.userId) !== String(decoded.userId)) {
      return NextResponse.json({ success: false, message: "Accesso non autorizzato." }, { status: 403 })
    }

    return NextResponse.json({ success: true, item }, { status: 200 })
  } catch (error) {
    console.error("[v0] Errore item collection:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
