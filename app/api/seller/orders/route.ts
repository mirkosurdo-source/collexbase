import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { connectDB } from "@/lib/db"
import { Types } from "mongoose"
import SellerOrder from "@/lib/models/SellerOrder"
import { serializeOrder } from "@/lib/seller"

// GET /api/seller/orders?role=seller|buyer&status=... — orders for the caller.
export async function GET(req: Request) {
  const userId = getAuthUserId(req)
  if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

  await connectDB()
  const url = new URL(req.url)
  const role = url.searchParams.get("role") === "buyer" ? "buyer" : "seller"
  const status = url.searchParams.get("status")

  const query: Record<string, unknown> = {}
  query[role === "buyer" ? "buyerId" : "sellerId"] = new Types.ObjectId(userId)
  if (status) query.status = status

  const orders = await SellerOrder.find(query).sort({ createdAt: -1 }).limit(200)
  return NextResponse.json({ success: true, orders: orders.map((o) => serializeOrder(o)) })
}
