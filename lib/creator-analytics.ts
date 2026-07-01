/**
 * Blocco 51.2 — Creator Pro advanced analytics.
 *
 * All metrics are computed live from the existing CreatorCommissionEvent and
 * ReferralEvent collections — no snapshot/cron tables are required and nothing
 * in the commission or referral engines is modified. Purely additive + read-only.
 */

import { connectDB } from "@/lib/db"
import CreatorCommissionEvent from "@/lib/models/CreatorCommissionEvent"
import ReferralEvent from "@/lib/models/ReferralEvent"
import User from "@/lib/models/User"

/** Resolves a time range (in days) to a start Date. */
function startDateForDays(days: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - (days - 1))
  return d
}

export interface AnalyticsOverview {
  invitedUsers: number
  totalCommission: number
  totalRevenueGenerated: number
  totalDiscountsApplied: number
  premiumSales: number
  goldSales: number
}

/** Aggregate totals for a creator over an optional day window (default: all-time). */
export async function getOverview(creatorId: string, days?: number): Promise<AnalyticsOverview> {
  await connectDB()

  const commissionQuery: Record<string, unknown> = { creatorId }
  const referralQuery: Record<string, unknown> = { inviterId: creatorId, coinsRewarded: true }
  if (days && days > 0) {
    const start = startDateForDays(days)
    commissionQuery.createdAt = { $gte: start }
    referralQuery.updatedAt = { $gte: start }
  }

  const [events, invitedUsers] = await Promise.all([
    CreatorCommissionEvent.find(commissionQuery).lean(),
    ReferralEvent.countDocuments(referralQuery),
  ])

  let totalCommission = 0
  let totalRevenueGenerated = 0
  let totalDiscountsApplied = 0
  let premiumSales = 0
  let goldSales = 0
  for (const e of events) {
    const ev = e as { amountSpent?: number; commissionAmount?: number; source?: string; discountApplied?: number }
    totalRevenueGenerated += Number(ev.amountSpent) || 0
    totalCommission += Number(ev.commissionAmount) || 0
    totalDiscountsApplied += Number(ev.discountApplied) || 0
    if ((ev.source || "premium").toLowerCase() === "gold") goldSales++
    else premiumSales++
  }

  const round = (n: number) => Math.round(n * 100) / 100
  return {
    invitedUsers,
    totalCommission: round(totalCommission),
    totalRevenueGenerated: round(totalRevenueGenerated),
    totalDiscountsApplied: round(totalDiscountsApplied),
    premiumSales,
    goldSales,
  }
}

export interface DailyPoint {
  day: string // YYYY-MM-DD
  commission: number
  revenue: number
  invitedUsers: number
  premiumSales: number
  goldSales: number
  discounts: number
}

/** Daily time series over the last `days` days (zero-filled). */
export async function getDaily(creatorId: string, days = 30): Promise<DailyPoint[]> {
  await connectDB()
  const start = startDateForDays(days)

  const [events, referrals] = await Promise.all([
    CreatorCommissionEvent.find({ creatorId, createdAt: { $gte: start } }).lean(),
    ReferralEvent.find({ inviterId: creatorId, coinsRewarded: true, updatedAt: { $gte: start } })
      .select("updatedAt")
      .lean(),
  ])

  const buckets = new Map<string, DailyPoint>()
  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    buckets.set(key, { day: key, commission: 0, revenue: 0, invitedUsers: 0, premiumSales: 0, goldSales: 0, discounts: 0 })
  }

  for (const e of events) {
    const ev = e as { createdAt?: Date; amountSpent?: number; commissionAmount?: number; source?: string; discountApplied?: number }
    const key = new Date(ev.createdAt ?? Date.now()).toISOString().slice(0, 10)
    const b = buckets.get(key)
    if (!b) continue
    b.commission += Number(ev.commissionAmount) || 0
    b.revenue += Number(ev.amountSpent) || 0
    b.discounts += Number(ev.discountApplied) || 0
    if ((ev.source || "premium").toLowerCase() === "gold") b.goldSales++
    else b.premiumSales++
  }
  for (const r of referrals) {
    const rr = r as { updatedAt?: Date }
    const key = new Date(rr.updatedAt ?? Date.now()).toISOString().slice(0, 10)
    const b = buckets.get(key)
    if (b) b.invitedUsers++
  }

  const round = (n: number) => Math.round(n * 100) / 100
  return Array.from(buckets.values()).map((b) => ({
    ...b,
    commission: round(b.commission),
    revenue: round(b.revenue),
    discounts: round(b.discounts),
  }))
}

export interface MonthlyPoint {
  month: string // YYYY-MM
  commission: number
  revenue: number
  invitedUsers: number
}

/** Monthly time series over the last `months` months (zero-filled). */
export async function getMonthly(creatorId: string, months = 12): Promise<MonthlyPoint[]> {
  await connectDB()
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(1)
  start.setMonth(start.getMonth() - (months - 1))

  const [events, referrals] = await Promise.all([
    CreatorCommissionEvent.find({ creatorId, createdAt: { $gte: start } }).lean(),
    ReferralEvent.find({ inviterId: creatorId, coinsRewarded: true, updatedAt: { $gte: start } })
      .select("updatedAt")
      .lean(),
  ])

  const buckets = new Map<string, MonthlyPoint>()
  for (let i = 0; i < months; i++) {
    const d = new Date(start)
    d.setMonth(start.getMonth() + i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    buckets.set(key, { month: key, commission: 0, revenue: 0, invitedUsers: 0 })
  }

  const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
  for (const e of events) {
    const ev = e as { createdAt?: Date; amountSpent?: number; commissionAmount?: number }
    const b = buckets.get(monthKey(new Date(ev.createdAt ?? Date.now())))
    if (!b) continue
    b.commission += Number(ev.commissionAmount) || 0
    b.revenue += Number(ev.amountSpent) || 0
  }
  for (const r of referrals) {
    const rr = r as { updatedAt?: Date }
    const b = buckets.get(monthKey(new Date(rr.updatedAt ?? Date.now())))
    if (b) b.invitedUsers++
  }

  const round = (n: number) => Math.round(n * 100) / 100
  return Array.from(buckets.values()).map((b) => ({
    ...b,
    commission: round(b.commission),
    revenue: round(b.revenue),
  }))
}

export interface InvitedUserRow {
  userId: string
  username: string
  totalSpent: number
  totalCommission: number
  purchases: number
  lastAt: string | null
}

/** Per invited-user spend summary, derived from commission events. */
export async function getInvitedUsers(creatorId: string, limit = 100): Promise<InvitedUserRow[]> {
  await connectDB()
  const events = await CreatorCommissionEvent.find({ creatorId }).sort({ createdAt: -1 }).lean()

  const byUser = new Map<string, { spent: number; commission: number; purchases: number; lastAt: number }>()
  for (const e of events) {
    const ev = e as { userId: string; amountSpent?: number; commissionAmount?: number; createdAt?: Date }
    const id = String(ev.userId)
    const cur = byUser.get(id) || { spent: 0, commission: 0, purchases: 0, lastAt: 0 }
    cur.spent += Number(ev.amountSpent) || 0
    cur.commission += Number(ev.commissionAmount) || 0
    cur.purchases++
    cur.lastAt = Math.max(cur.lastAt, new Date(ev.createdAt ?? 0).getTime())
    byUser.set(id, cur)
  }

  const ids = Array.from(byUser.keys()).slice(0, limit)
  const users = await User.find({ _id: { $in: ids } }).select("username").lean()
  const nameById = new Map(users.map((u) => [String((u as { _id: unknown })._id), (u as { username?: string }).username || "Utente"]))

  const round = (n: number) => Math.round(n * 100) / 100
  return ids.map((id) => {
    const s = byUser.get(id)!
    return {
      userId: id,
      username: nameById.get(id) || "Utente",
      totalSpent: round(s.spent),
      totalCommission: round(s.commission),
      purchases: s.purchases,
      lastAt: s.lastAt ? new Date(s.lastAt).toISOString() : null,
    }
  })
}

export interface CommissionRow {
  userId: string
  amountSpent: number
  commissionAmount: number
  source: string
  at: string
}

/** Detailed commission history (most recent first). */
export async function getCommissionHistory(creatorId: string, limit = 200): Promise<CommissionRow[]> {
  await connectDB()
  const events = await CreatorCommissionEvent.find({ creatorId }).sort({ createdAt: -1 }).limit(limit).lean()
  return events.map((e) => {
    const ev = e as { userId: string; amountSpent?: number; commissionAmount?: number; source?: string; createdAt?: Date }
    return {
      userId: String(ev.userId),
      amountSpent: Math.round((Number(ev.amountSpent) || 0) * 100) / 100,
      commissionAmount: Math.round((Number(ev.commissionAmount) || 0) * 100) / 100,
      source: ev.source || "premium",
      at: new Date(ev.createdAt ?? Date.now()).toISOString(),
    }
  })
}
