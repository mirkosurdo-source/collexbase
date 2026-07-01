import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import { getAuthUserId } from "@/lib/auth/request"
import { getOrCreateWallet } from "@/lib/wallet"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    const body = await req.json()
    const { name, email, birthdate, address, bio, visibility } = body

    await connectDB()

    const updates: Record<string, unknown> = {}

    if (typeof name === "string") {
      if (name.trim().length < 2) {
        return NextResponse.json({ success: false, message: "Il nome deve avere almeno 2 caratteri." }, { status: 400 })
      }
      updates.name = name.trim()
    }

    if (typeof email === "string") {
      if (!EMAIL_RE.test(email.trim())) {
        return NextResponse.json({ success: false, message: "Email non valida." }, { status: 400 })
      }
      const normalized = email.trim().toLowerCase()
      const existing = await User.findOne({ email: normalized })
      if (existing && String(existing._id) !== userId) {
        return NextResponse.json({ success: false, message: "Email già in uso." }, { status: 409 })
      }
      updates.email = normalized
    }

    if (typeof bio === "string") {
      if (bio.length > 1000) {
        return NextResponse.json({ success: false, message: "La bio non può superare i 1000 caratteri." }, { status: 400 })
      }
      updates.bio = bio
    }

    if (typeof address === "string") updates.address = address.trim()

    if (birthdate !== undefined) {
      if (birthdate) {
        const date = new Date(birthdate)
        if (Number.isNaN(date.getTime())) {
          return NextResponse.json({ success: false, message: "Data di nascita non valida." }, { status: 400 })
        }
        updates.birthdate = date
      } else {
        updates.birthdate = null
      }
    }

    const user = await User.findByIdAndUpdate(userId, updates, { new: true, runValidators: true }).select("-password")
    if (!user) {
      return NextResponse.json({ success: false, message: "Utente non trovato." }, { status: 404 })
    }

    // Item visibility lives on the wallet/profile-settings doc to avoid altering the User schema.
    const wallet = await getOrCreateWallet(userId)
    if (visibility === "public" || visibility === "private") {
      wallet.itemsVisibility = visibility
      await wallet.save()
    }

    return NextResponse.json({
      success: true,
      message: "Profilo aggiornato.",
      user: {
        id: String(user._id),
        name: user.name,
        username: user.username,
        email: user.email,
        bio: user.bio,
        birthdate: user.birthdate,
        address: user.address,
        avatar: user.avatar,
        visibility: wallet.itemsVisibility,
      },
    })
  } catch (error) {
    console.error("[v0] Errore update-advanced:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
