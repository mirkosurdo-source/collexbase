import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { connectDB } from "@/lib/db"
import { Types } from "mongoose"
import SellerInventoryItem from "@/lib/models/SellerInventoryItem"
import Listing from "@/lib/models/Listing"
import { createSellerOrder, serializeOrder } from "@/lib/seller"
import { createNotification } from "@/lib/notifications"

// POST /api/seller/checkout { itemId, quantity? } — purchase a published Pro
// item. Creates a SellerOrder (commission + payout computed) and decrements
// inventory. Payment capture/escrow is layered on top of the base flow.
export async function POST(req: Request) {
  const buyerId = getAuthUserId(req)
  if (!buyerId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const itemId = String(body.itemId || "").trim()
  const quantity = Math.max(1, Number(body.quantity) || 1)
  if (!itemId) return NextResponse.json({ success: false, message: "itemId mancante." }, { status: 400 })

  await connectDB()
  const item = await SellerInventoryItem.findById(itemId)
  if (!item || !item.published)
    return NextResponse.json({ success: false, message: "Articolo non disponibile." }, { status: 404 })
  if (String(item.sellerId) === buyerId)
    return NextResponse.json({ success: false, message: "Non puoi acquistare un tuo articolo." }, { status: 400 })
  if (item.quantity < quantity)
    return NextResponse.json({ success: false, message: "Quantità non disponibile." }, { status: 400 })

  const res = await createSellerOrder({
    sellerId: String(item.sellerId),
    buyerId,
    items: [{ inventoryItemId: String(item._id), title: item.title, image: item.images[0] || "", price: item.price, quantity }],
    status: "paid",
  })
  if (!res.ok || !res.order)
    return NextResponse.json({ success: false, message: res.error || "Errore." }, { status: 400 })

  // Decrement stock; unpublish the mirrored listing when sold out.
  item.quantity -= quantity
  if (item.quantity <= 0 && item.listingId) {
    await Listing.findByIdAndUpdate(item.listingId, { status: "sold" })
    item.published = false
  }
  await item.save()

  await createNotification({
    userId: String(item.sellerId),
    type: "marketplace",
    title: "Nuovo ordine",
    body: `Hai ricevuto un ordine per "${item.title}".`,
    link: "/seller",
  }).catch(() => {})

  return NextResponse.json({ success: true, order: serializeOrder(res.order) })
}
