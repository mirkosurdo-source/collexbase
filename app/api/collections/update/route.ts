import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import CollectionItem from "@/lib/models/Collection"
import { verifyToken } from "@/lib/auth/jwt"
import { createNotification } from "@/lib/notifications"

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

    const updates: Record<string, unknown> = {}

    if (typeof body.name === "string") {
      const name = body.name.trim()
      if (name.length < 1) {
        return NextResponse.json({ success: false, message: "Il nome dell'oggetto è obbligatorio." }, { status: 400 })
      }
      updates.name = name
    }
    if (typeof body.description === "string") updates.description = body.description.trim()
    if (typeof body.category === "string") updates.category = body.category.trim()
    if (typeof body.condition === "string") updates.condition = body.condition.trim()
    if (typeof body.image === "string") updates.image = body.image.trim()

    if (body.year !== undefined) {
      if (body.year === null || body.year === "") {
        updates.year = null
      } else {
        const year = Number(body.year)
        if (Number.isNaN(year)) {
          return NextResponse.json({ success: false, message: "Anno non valido." }, { status: 400 })
        }
        updates.year = year
      }
    }

    if (body.value !== undefined) {
      if (body.value === null || body.value === "") {
        updates.value = null
      } else {
        const value = Number(body.value)
        if (Number.isNaN(value)) {
          return NextResponse.json({ success: false, message: "Valore non valido." }, { status: 400 })
        }
        updates.value = value
      }
    }

    const item = await CollectionItem.findByIdAndUpdate(id, updates, { new: true, runValidators: true })

    // Trigger: notify the owner that one of their items was updated.
    await createNotification({
      userId: decoded.userId,
      type: "system",
      title: "Oggetto aggiornato",
      body: `Hai aggiornato "${(item as Record<string, unknown> | null)?.name || "un oggetto"}" nella tua collezione.`,
      link: `/collections/${id}`,
    })

    return NextResponse.json(
      { success: true, message: "Oggetto aggiornato con successo.", item },
      { status: 200 },
    )
  } catch (error) {
    console.error("[v0] Errore update collection:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
