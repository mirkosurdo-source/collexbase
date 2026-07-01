import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Auction from "@/lib/models/Auction"
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

    const itemName = typeof body.itemName === "string" ? body.itemName.trim() : ""
    if (itemName.length < 1) {
      return NextResponse.json({ success: false, message: "Il nome dell'oggetto è obbligatorio." }, { status: 400 })
    }

    const startingPrice = Number(body.startingPrice)
    if (Number.isNaN(startingPrice) || startingPrice < 0) {
      return NextResponse.json({ success: false, message: "Prezzo iniziale non valido." }, { status: 400 })
    }

    const minIncrement = Number(body.minIncrement)
    if (Number.isNaN(minIncrement) || minIncrement <= 0) {
      return NextResponse.json({ success: false, message: "Incremento minimo non valido." }, { status: 400 })
    }

    const durationHours = Number(body.durationHours)
    if (Number.isNaN(durationHours) || durationHours <= 0) {
      return NextResponse.json({ success: false, message: "Durata non valida." }, { status: 400 })
    }

    await connectDB()

    const endsAt = new Date(Date.now() + durationHours * 60 * 60 * 1000)

    const auction = await Auction.create({
      userId: decoded.userId,
      itemName,
      description: typeof body.description === "string" ? body.description.trim() : "",
      image: typeof body.image === "string" ? body.image.trim() : "",
      startingPrice,
      currentPrice: startingPrice,
      minIncrement,
      status: "active",
      endsAt,
    })

    return NextResponse.json(
      { success: true, message: "Asta creata con successo.", auction },
      { status: 201 },
    )
  } catch (error) {
    console.error("[v0] Errore create auction:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
