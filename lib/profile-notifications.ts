/**
 * Blocco 27 — badge & level-up notifications in the CollexSpark voice.
 *
 * `syncProfileProgress` computes the user's current badges + level, diffs them
 * against the persisted ProfileProgress snapshot, and fires a notification for
 * each newly earned badge and each level gained. Fire-and-forget: any failure
 * is logged but never thrown, so callers are never broken.
 */

import { connectDB } from "@/lib/db"
import ProfileProgress from "@/lib/models/ProfileProgress"
import { createNotification } from "@/lib/notifications"
import { earnedBadgeIds, levelFromScore, BADGE_CATALOG, type BadgeMetrics } from "@/lib/badges"

const SPARK = "⚡ CollexSpark"

const BADGE_LABEL = new Map(BADGE_CATALOG.map((b) => [b.id, b.label]))

export interface SyncResult {
  newBadges: string[]
  leveledUp: boolean
  level: number
}

/**
 * Recomputes badges/level for a user and notifies on anything newly unlocked.
 * `score` is the reputation score (0-100) used for the level.
 */
export async function syncProfileProgress(
  userId: string,
  metrics: BadgeMetrics,
  score: number,
): Promise<SyncResult> {
  const result: SyncResult = { newBadges: [], leveledUp: false, level: 1 }
  try {
    await connectDB()

    const currentBadges = earnedBadgeIds(metrics)
    const level = levelFromScore(score).level
    result.level = level

    const snapshot = await ProfileProgress.findOne({ userId }).lean<{
      level: number
      badgeIds: string[]
    } | null>()

    const prevBadges = new Set(snapshot?.badgeIds ?? [])
    const prevLevel = snapshot?.level ?? (snapshot ? 1 : null)

    const newBadges = currentBadges.filter((id) => !prevBadges.has(id))
    result.newBadges = newBadges

    // First-ever sync just records the baseline without spamming notifications.
    const isFirstSync = snapshot === null

    await ProfileProgress.findOneAndUpdate(
      { userId },
      { userId, level, score, badgeIds: currentBadges },
      { upsert: true, setDefaultsOnInsert: true },
    )

    if (isFirstSync) return result

    // Notify for each newly earned badge.
    for (const id of newBadges) {
      await createNotification({
        userId,
        type: "system",
        title: `${SPARK}: hai guadagnato un nuovo badge!`,
        body: `Hai sbloccato il badge "${BADGE_LABEL.get(id) ?? id}". Continua così!`,
        link: "/profile",
      })
    }

    // Notify on level-up.
    if (prevLevel != null && level > prevLevel) {
      result.leveledUp = true
      const tier = levelFromScore(score).name
      await createNotification({
        userId,
        type: "system",
        title: `${SPARK}: sei salito al livello ${level}!`,
        body:
          level >= 5
            ? "Sei diventato una leggenda del collezionismo!"
            : `Ora sei ${tier}. La tua reputazione continua a crescere!`,
        link: "/profile",
      })
    }

    return result
  } catch (error) {
    console.error("[v0] syncProfileProgress error:", error)
    return result
  }
}
