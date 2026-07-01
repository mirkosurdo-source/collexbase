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

    const name = typeof body.name === "string" ? body.name.trim() : ""
    if (name.length < 1) {
      return NextResponse.json({ success: false, message: "Il nome dell'oggetto è obbligatorio." }, { status: 400 })
    }

    const year = body.year !== undefined && body.year !== null && body.year !== "" ? Number(body.year) : null
    if (year !== null && Number.isNaN(year)) {
      return NextResponse.json({ success: false, message: "Anno non valido." }, { status: 400 })
    }

    const value = body.value !== undefined && body.value !== null && body.value !== "" ? Number(body.value) : null
    if (value !== null && Number.isNaN(value)) {
      return NextResponse.json({ success: false, message: "Valore non valido." }, { status: 400 })
    }

    await connectDB()

    const item = await CollectionItem.create({
      userId: decoded.userId,
      name,
      description: typeof body.description === "string" ? body.description.trim() : "",
      category: typeof body.category === "string" ? body.category.trim() : "",
      year,
      value,
      condition: typeof body.condition === "string" ? body.condition.trim() : "",
      image: typeof body.image === "string" ? body.image.trim() : "",
    })

    return NextResponse.json(
      { success: true, message: "Oggetto aggiunto con successo.", item },
      { status: 201 },
    )
  } catch (error) {
    console.error("[v0] Errore create collection:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
