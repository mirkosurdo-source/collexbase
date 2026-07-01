"use client"

export function sellerToken(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem("token") : null
}

export function authHeaders(json = false): Record<string, string> {
  const h: Record<string, string> = { Authorization: `Bearer ${sellerToken() || ""}` }
  if (json) h["Content-Type"] = "application/json"
  return h
}

export async function sellerGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: authHeaders() })
  return res.json()
}

export async function sellerPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: authHeaders(true),
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}

export async function sellerPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "PATCH", headers: authHeaders(true), body: JSON.stringify(body) })
  return res.json()
}

export async function sellerDelete<T>(path: string): Promise<T> {
  const res = await fetch(path, { method: "DELETE", headers: authHeaders() })
  return res.json()
}

export function fmtEUR(value: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value || 0)
}

export function fmtNum(value: number): string {
  return new Intl.NumberFormat("it-IT").format(value || 0)
}

export function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "In attesa",
  paid: "Pagato",
  shipped: "Spedito",
  completed: "Completato",
  cancelled: "Annullato",
  refunded: "Rimborsato",
  disputed: "Contestato",
}

export interface SellerOrderDTO {
  id: string
  sellerId: string
  buyerId: string
  items: { title: string; image: string; price: number; quantity: number }[]
  total: number
  commission: number
  payoutAmount: number
  status: string
  trackingCarrier?: string
  trackingNumber?: string
  payoutSettled: boolean
  reviewed: boolean
  createdAt: string
  shippedAt?: string
  completedAt?: string
}

export interface SellerProfileDTO {
  id: string
  userId: string
  username: string
  active: boolean
  commissionRate: number
  totalSales: number
  totalOrders: number
  totalCommission: number
  totalPayout: number
  rating: number
  ratingCount: number
  stripe: { connected: boolean; chargesEnabled: boolean; payoutsEnabled: boolean; detailsSubmitted: boolean }
  createdAt: string
}
