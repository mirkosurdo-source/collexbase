import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import { generateToken } from "@/lib/auth/jwt"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Email e password sono obbligatori." },
        { status: 400 },
      )
    }

    await connectDB()

    const user = await User.findOne({ email: String(email).toLowerCase() })
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Credenziali non valide." },
        { status: 401 },
      )
    }

    // Blocco 49: Google-only accounts have no password — direct them to social login.
    if (!user.password) {
      return NextResponse.json(
        { success: false, message: "Questo account usa l'accesso con Google." },
        { status: 401 },
      )
    }

    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      return NextResponse.json(
        { success: false, message: "Credenziali non valide." },
        { status: 401 },
      )
    }

    const token = generateToken(String(user._id))

    return NextResponse.json(
      {
        success: true,
        message: "Login effettuato con successo.",
        token,
        user: {
          id: user._id,
          name: user.name,
          username: user.username,
          email: user.email,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("[v0] Errore login:", error)
    return NextResponse.json(
      { success: false, message: "Errore interno del server." },
      { status: 500 },
    )
  }
}
