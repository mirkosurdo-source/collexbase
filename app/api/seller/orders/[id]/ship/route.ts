import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { markOrderShipped, serializeOrder } from "@/lib/seller"
import { createNotification } from "@/lib/notifications"

// POST /api/seller/orders/[id]/ship { carrier?, trackingNumber? } — seller only.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = getAuthUserId(req)
  if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const res = await markOrderShipped({
    sellerId: userId,
    orderId: id,
    carrier: body.carrier,
    trackingNumber: body.trackingNumber,
  })
  if (!res.ok || !res.order)
    return NextResponse.json({ success: false, message: res.error || "Errore." }, { status: 400 })

  await createNotification({
    userId: String(res.order.buyerId),
    type: "marketplace",
    title: "Ordine spedito",
    body: res.order.trackingNumber
      ? `Il tuo ordine è stato spedito (${res.order.trackingCarrier} ${res.order.trackingNumber}).`
      : "Il tuo ordine è stato spedito.",
    link: "/seller/orders",
  }).catch(() => {})

  return NextResponse.json({ success: true, order: serializeOrder(res.order) })
}
