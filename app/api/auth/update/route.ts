import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
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

    // Validazione dei campi
    const updates: Record<string, unknown> = {}

    if (typeof body.name === "string") {
      const name = body.name.trim()
      if (name.length < 2) {
        return NextResponse.json({ success: false, message: "Il nome deve avere almeno 2 caratteri." }, { status: 400 })
      }
      updates.name = name
    }

    if (typeof body.bio === "string") {
      if (body.bio.length > 500) {
        return NextResponse.json({ success: false, message: "La bio non può superare i 500 caratteri." }, { status: 400 })
      }
      updates.bio = body.bio.trim()
    }

    if (typeof body.address === "string") {
      updates.address = body.address.trim()
    }

    if (typeof body.avatar === "string") {
      updates.avatar = body.avatar.trim()
    }

    if (typeof body.birthdate === "string" && body.birthdate.length > 0) {
      const date = new Date(body.birthdate)
      if (Number.isNaN(date.getTime())) {
        return NextResponse.json({ success: false, message: "Data di nascita non valida." }, { status: 400 })
      }
      updates.birthdate = date
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, message: "Nessun dato da aggiornare." }, { status: 400 })
    }

    await connectDB()

    const user = await User.findByIdAndUpdate(decoded.userId, updates, {
      new: true,
      runValidators: true,
    }).select("-password")

    if (!user) {
      return NextResponse.json({ success: false, message: "Utente non trovato." }, { status: 404 })
    }

    return NextResponse.json(
      {
        success: true,
        message: "Profilo aggiornato con successo.",
        user: {
          id: user._id,
          name: user.name,
          username: user.username,
          email: user.email,
          bio: user.bio,
          birthdate: user.birthdate,
          address: user.address,
          avatar: user.avatar,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("[v0] Errore update:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
