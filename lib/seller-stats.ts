/**
 * Blocco 41 — seller badge metrics.
 *
 * Read-only aggregation feeding the badge engine via gatherProfileStats. A user
 * with no seller profile simply returns zeros, so non-sellers are unaffected.
 */
import { connectDB } from "@/lib/db"
import { Types } from "mongoose"
import SellerProfile from "@/lib/models/SellerProfile"

export interface SellerBadgeMetrics {
  /** 1 when an active Pro seller, else 0. */
  sellerActive: number
  /** Completed orders (lifetime). */
  sellerCompletedOrders: number
  /** Whole months the rating has stayed >= 4.8 (Trusted Seller gate). */
  sellerTrustedMonths: number
}

function toObjectId(id: string): Types.ObjectId | string {
  try {
    return new Types.ObjectId(id)
  } catch {
    return id
  }
}

export async function gatherSellerBadgeMetrics(userId: string): Promise<SellerBadgeMetrics> {
  await connectDB()
  const profile = await SellerProfile.findOne({ userId: toObjectId(userId) }).select(
    "active totalOrders rating highRatingSince",
  )
  if (!profile) {
    return { sellerActive: 0, sellerCompletedOrders: 0, sellerTrustedMonths: 0 }
  }

  let trustedMonths = 0
  if (profile.rating >= 4.8 && profile.highRatingSince) {
    const ms = Date.now() - new Date(profile.highRatingSince).getTime()
    trustedMonths = Math.floor(ms / (1000 * 60 * 60 * 24 * 30))
  }

  return {
    sellerActive: profile.active ? 1 : 0,
    sellerCompletedOrders: profile.totalOrders || 0,
    sellerTrustedMonths: trustedMonths,
  }
}
