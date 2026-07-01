import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { connectDB } from "@/lib/db"
import { Types } from "mongoose"
import SellerOrder from "@/lib/models/SellerOrder"
import SellerProfile from "@/lib/models/SellerProfile"
import Review from "@/lib/models/Review"
import User from "@/lib/models/User"
import { addSellerRating } from "@/lib/seller"
import { createNotification } from "@/lib/notifications"

// POST /api/seller/orders/[id]/review { rating, comment } — buyer reviews the
// seller for a completed order (one review per order).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = getAuthUserId(req)
  if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const rating = Number(body.rating)
  if (!Number.isFinite(rating) || rating < 1 || rating > 5)
    return NextResponse.json({ success: false, message: "Valutazione non valida (1-5)." }, { status: 400 })

  await connectDB()
  const order = await SellerOrder.findOne({ _id: new Types.ObjectId(id), buyerId: new Types.ObjectId(userId) })
  if (!order) return NextResponse.json({ success: false, message: "Ordine non trovato." }, { status: 404 })
  if (order.status !== "completed")
    return NextResponse.json({ success: false, message: "Puoi recensire solo ordini completati." }, { status: 400 })
  if (order.reviewed)
    return NextResponse.json({ success: false, message: "Hai già recensito questo ordine." }, { status: 400 })

  const [author, seller] = await Promise.all([
    User.findById(userId).select("username avatar"),
    SellerProfile.findOne({ userId: order.sellerId }).select("username"),
  ])

  await Review.create({
    targetUserId: order.sellerId,
    targetUsername: seller?.username || "",
    authorId: new Types.ObjectId(userId),
    authorUsername: author?.username || "",
    authorAvatar: author?.avatar || "",
    type: "seller",
    rating: Math.round(rating),
    comment: String(body.comment || "").trim().slice(0, 1000),
    refId: String(order._id),
  })

  await addSellerRating(String(order.sellerId), rating)
  order.reviewed = true
  await order.save()

  await createNotification({
    userId: String(order.sellerId),
    type: "marketplace",
    title: "Nuova recensione",
    body: `Hai ricevuto una valutazione di ${Math.round(rating)} stelle.`,
    link: "/seller",
  }).catch(() => {})

  return NextResponse.json({ success: true })
}
