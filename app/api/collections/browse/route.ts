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

// Returns collection items NOT belonging to the authenticated user.
// Used to pick the "requested" item when proposing a trade.
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

    const { searchParams } = new URL(req.url)
    const query = searchParams.get("query")?.trim() || ""

    const filter: Record<string, unknown> = { userId: { $ne: decoded.userId } }

    if (query) {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const regex = new RegExp(escaped, "i")
      filter.$or = [{ name: regex }, { category: regex }, { condition: regex }]
    }

    const items = await CollectionItem.find(filter).sort({ createdAt: -1 }).limit(50)

    return NextResponse.json({ success: true, items }, { status: 200 })
  } catch (error) {
    console.error("[v0] Errore browse collection:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
