import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Trade from "@/lib/models/Trade"
import CollectionItem from "@/lib/models/Collection"
import User from "@/lib/models/User"
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

    const offeredItemId = typeof body.offeredItemId === "string" ? body.offeredItemId : ""
    const requestedItemId = typeof body.requestedItemId === "string" ? body.requestedItemId : ""
    const message = typeof body.message === "string" ? body.message.trim() : ""

    if (!offeredItemId || !requestedItemId) {
      return NextResponse.json(
        { success: false, message: "Devi selezionare un oggetto offerto e uno richiesto." },
        { status: 400 },
      )
    }

    if (offeredItemId === requestedItemId) {
      return NextResponse.json(
        { success: false, message: "L'oggetto offerto e quello richiesto non possono coincidere." },
        { status: 400 },
      )
    }

    if (message.length > 1000) {
      return NextResponse.json({ success: false, message: "Il messaggio è troppo lungo." }, { status: 400 })
    }

    await connectDB()

    const offered = await CollectionItem.findById(offeredItemId).lean()
    const requested = await CollectionItem.findById(requestedItemId).lean()

    if (!offered || !requested) {
      return NextResponse.json({ success: false, message: "Oggetto non trovato." }, { status: 404 })
    }

    const offeredItem = offered as Record<string, unknown>
    const requestedItem = requested as Record<string, unknown>

    // The offered item must belong to the proposer.
    if (offeredItem.userId !== decoded.userId) {
      return NextResponse.json(
        { success: false, message: "Puoi offrire solo i tuoi oggetti." },
        { status: 403 },
      )
    }

    // The requested item must belong to someone else.
    if (requestedItem.userId === decoded.userId) {
      return NextResponse.json(
        { success: false, message: "Non puoi richiedere un tuo stesso oggetto." },
        { status: 400 },
      )
    }

    let fromUsername = ""
    let toUsername = ""
    try {
      const fromUser = await User.findById(decoded.userId).lean()
      fromUsername = ((fromUser as Record<string, unknown> | null)?.username as string) || ""
      const toUser = await User.findById(requestedItem.userId as string).lean()
      toUsername = ((toUser as Record<string, unknown> | null)?.username as string) || ""
    } catch {
      // Non-blocking.
    }

    const trade = await Trade.create({
      fromUserId: decoded.userId,
      fromUsername,
      toUserId: requestedItem.userId,
      toUsername,
      offeredItemId,
      offeredItemName: offeredItem.name || "",
      offeredItemImage: offeredItem.image || "",
      requestedItemId,
      requestedItemName: requestedItem.name || "",
      requestedItemImage: requestedItem.image || "",
      message,
      status: "pending",
      messages: [],
    })

    // Trigger: notify the recipient about the incoming trade proposal.
    await createNotification({
      userId: String(requestedItem.userId),
      type: "trade",
      title: "Nuova proposta di scambio",
      body: `${fromUsername || "Un utente"} vuole scambiare "${offeredItem.name}" con il tuo "${requestedItem.name}".`,
      link: `/trades/${trade._id}`,
    })

    return NextResponse.json({ success: true, message: "Proposta di scambio inviata.", trade })
  } catch (error) {
    console.error("[v0] Errore create trade:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
