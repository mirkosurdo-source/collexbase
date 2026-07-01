import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import {
  getActiveSellerProfile,
  updateInventoryItem,
  deleteInventoryItem,
  setItemPublished,
  serializeInventoryItem,
} from "@/lib/seller"

// PATCH /api/seller/inventory/[id] — update fields and/or toggle publish.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = getAuthUserId(req)
  if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

  const profile = await getActiveSellerProfile(userId)
  if (!profile)
    return NextResponse.json({ success: false, message: "Profilo venditore non attivo." }, { status: 403 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))

  // Publish toggle is a dedicated action.
  if (typeof body.published === "boolean") {
    const res = await setItemPublished(userId, id, body.published)
    if (!res.ok || !res.item)
      return NextResponse.json({ success: false, message: res.error || "Errore." }, { status: 400 })
    return NextResponse.json({ success: true, item: serializeInventoryItem(res.item) })
  }

  const res = await updateInventoryItem(userId, id, {
    title: body.title,
    description: body.description,
    category: body.category,
    condition: body.condition,
    cardId: body.cardId,
    price: body.price != null ? Number(body.price) : undefined,
    quantity: body.quantity != null ? Number(body.quantity) : undefined,
    images: Array.isArray(body.images) ? body.images : undefined,
  })
  if (!res.ok || !res.item)
    return NextResponse.json({ success: false, message: res.error || "Errore." }, { status: 400 })
  return NextResponse.json({ success: true, item: serializeInventoryItem(res.item) })
}

// DELETE /api/seller/inventory/[id] — remove an inventory item.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = getAuthUserId(req)
  if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

  const profile = await getActiveSellerProfile(userId)
  if (!profile)
    return NextResponse.json({ success: false, message: "Profilo venditore non attivo." }, { status: 403 })

  const { id } = await params
  const res = await deleteInventoryItem(userId, id)
  if (!res.ok) return NextResponse.json({ success: false, message: res.error || "Errore." }, { status: 400 })
  return NextResponse.json({ success: true })
}
