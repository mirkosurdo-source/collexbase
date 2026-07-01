import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
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

    await connectDB()

    const user = await User.findById(decoded.userId).select("-password")
    if (!user) {
      return NextResponse.json({ success: false, message: "Utente non trovato." }, { status: 404 })
    }

    return NextResponse.json(
      {
        success: true,
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
    console.error("[v0] Errore me:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
