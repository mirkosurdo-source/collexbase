import mongoose, { Schema, model, models } from "mongoose"

/**
 * Blocco 34 — a per-day snapshot of a user's collection analytics.
 *
 * One document per user per UTC day (deduped via the unique compound index on
 * { userId, day }). Snapshots let us compute consecutive-day usage streaks and
 * 7/30-day value trends without touching any existing engine.
 */
const AnalyticsSnapshotSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    // UTC day key, e.g. "2026-06-30", used to dedupe daily snapshots.
    day: { type: String, required: true },
    totalValue: { type: Number, default: 0 },
    totalItems: { type: Number, default: 0 },
    rareCount: { type: Number, default: 0 },
    highValueCount: { type: Number, default: 0 },
    duplicateCount: { type: Number, default: 0 },
    categories: { type: Schema.Types.Mixed, default: {} },
    trend7d: { type: Number, default: 0 },
    trend30d: { type: Number, default: 0 },
    // Cumulative badge counters carried forward day to day.
    trendsIdentified: { type: Number, default: 0 },
    marketAnalyzed: { type: Number, default: 0 },
  },
  { timestamps: true },
)

AnalyticsSnapshotSchema.index({ userId: 1, day: 1 }, { unique: true })

const AnalyticsSnapshot = models.AnalyticsSnapshot || model("AnalyticsSnapshot", AnalyticsSnapshotSchema)

export default AnalyticsSnapshot
