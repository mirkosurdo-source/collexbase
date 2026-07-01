import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { completeOrder, serializeOrder } from "@/lib/seller"
import { createNotification } from "@/lib/notifications"

// POST /api/seller/orders/[id]/complete — seller marks an order completed,
// which settles the payout. (Buyers use the /confirm endpoint instead.)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = getAuthUserId(req)
  if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

  const { id } = await params
  const res = await completeOrder({ orderId: id, bySellerId: userId })
  if (!res.ok || !res.order)
    return NextResponse.json({ success: false, message: res.error || "Errore." }, { status: 400 })

  await createNotification({
    userId: String(res.order.buyerId),
    type: "marketplace",
    title: "Ordine completato",
    body: "Il tuo ordine è stato segnato come completato.",
    link: "/seller/orders",
  }).catch(() => {})

  return NextResponse.json({ success: true, order: serializeOrder(res.order) })
}
