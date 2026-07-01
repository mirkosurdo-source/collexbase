import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, username, email, password, birthdate, address, bio, avatar } = body

    if (!name || !username || !email || !password) {
      return NextResponse.json(
        { success: false, message: "Nome, username, email e password sono obbligatori." },
        { status: 400 },
      )
    }

    if (typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { success: false, message: "La password deve contenere almeno 6 caratteri." },
        { status: 400 },
      )
    }

    await connectDB()

    const existing = await User.findOne({ $or: [{ email }, { username }] })
    if (existing) {
      return NextResponse.json(
        { success: false, message: "Email o username già in uso." },
        { status: 409 },
      )
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await User.create({
      name,
      username,
      email,
      password: hashedPassword,
      birthdate: birthdate ? new Date(birthdate) : undefined,
      address,
      bio,
      avatar,
    })

    return NextResponse.json(
      {
        success: true,
        message: "Registrazione completata con successo.",
        user: {
          id: user._id,
          name: user.name,
          username: user.username,
          email: user.email,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("[v0] Errore registrazione:", error)
    return NextResponse.json(
      { success: false, message: "Errore interno del server." },
      { status: 500 },
    )
  }
}
