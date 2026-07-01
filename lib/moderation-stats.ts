/**
 * Blocco 37 — moderation badge metrics.
 *
 * Read-only aggregation over ModerationEvent. Returns the raw signals the badge
 * engine needs; `safeTrades` / `communityCleaned` are derived in
 * gatherProfileStats from the user's existing trade/post counts minus the
 * flags recorded here, so this module stays self-contained and additive.
 */

import { connectDB } from "@/lib/db"
import ModerationEvent from "@/lib/models/ModerationEvent"

export interface ModerationBadgeRaw {
  /** Content the user removed (resolution "removed") while acting as moderator. */
  guardianReports: number
  /** Total moderation events the user handled/resolved. */
  detectiveDetections: number
  /** Trade events flagged against the user (subtracted from clean trades). */
  tradeFlags: number
  /** Post/comment events flagged against the user (subtracted from clean posts). */
  communityFlags: number
}

export async function gatherModerationBadgeRaw(userId: string): Promise<ModerationBadgeRaw> {
  await connectDB()

  const [guardianReports, detectiveDetections, tradeFlags, communityFlags] = await Promise.all([
    ModerationEvent.countDocuments({ resolvedBy: userId, resolution: "removed" }),
    ModerationEvent.countDocuments({ resolvedBy: userId }),
    ModerationEvent.countDocuments({ userId, targetType: "trade" }),
    ModerationEvent.countDocuments({ userId, targetType: { $in: ["post", "comment"] } }),
  ])

  return { guardianReports, detectiveDetections, tradeFlags, communityFlags }
}
