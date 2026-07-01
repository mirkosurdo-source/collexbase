import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { completeOrder, serializeOrder } from "@/lib/seller"
import { createNotification } from "@/lib/notifications"

// POST /api/seller/orders/[id]/confirm — buyer confirms receipt, completing the
// order and releasing the seller payout.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = getAuthUserId(req)
  if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

  const { id } = await params
  const res = await completeOrder({ orderId: id, byBuyerId: userId })
  if (!res.ok || !res.order)
    return NextResponse.json({ success: false, message: res.error || "Errore." }, { status: 400 })

  await createNotification({
    userId: String(res.order.sellerId),
    type: "marketplace",
    title: "Ricezione confermata",
    body: "L'acquirente ha confermato la ricezione. Il payout è stato avviato.",
    link: "/seller",
  }).catch(() => {})

  return NextResponse.json({ success: true, order: serializeOrder(res.order) })
}
