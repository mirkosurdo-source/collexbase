import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { connectDB } from "@/lib/db"
import SellerInventoryItem from "@/lib/models/SellerInventoryItem"
import { Types } from "mongoose"
import { getActiveSellerProfile, createInventoryItem, serializeInventoryItem } from "@/lib/seller"

// GET /api/seller/inventory — list the caller's inventory.
export async function GET(req: Request) {
  const userId = getAuthUserId(req)
  if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

  const profile = await getActiveSellerProfile(userId)
  if (!profile)
    return NextResponse.json({ success: false, message: "Profilo venditore non attivo." }, { status: 403 })

  await connectDB()
  const items = await SellerInventoryItem.find({ sellerId: new Types.ObjectId(userId) }).sort({ updatedAt: -1 })
  return NextResponse.json({ success: true, items: items.map((i) => serializeInventoryItem(i)) })
}

// POST /api/seller/inventory — create an inventory item.
export async function POST(req: Request) {
  const userId = getAuthUserId(req)
  if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

  const profile = await getActiveSellerProfile(userId)
  if (!profile)
    return NextResponse.json({ success: false, message: "Profilo venditore non attivo." }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const res = await createInventoryItem(userId, {
    cardId: body.cardId,
    title: body.title,
    description: body.description,
    category: body.category,
    condition: body.condition,
    price: Number(body.price),
    quantity: body.quantity != null ? Number(body.quantity) : undefined,
    images: Array.isArray(body.images) ? body.images : undefined,
  })
  if (!res.ok || !res.item)
    return NextResponse.json({ success: false, message: res.error || "Errore." }, { status: 400 })

  return NextResponse.json({ success: true, item: serializeInventoryItem(res.item) })
}
