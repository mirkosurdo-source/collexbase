import { Schema, models, model } from "mongoose"

/**
 * Blocco 37 — Automatic AI moderation.
 *
 * A single moderation event produced either by the automatic AI/heuristic
 * pipeline (lib/moderation.ts) or by an admin action. Fully additive: it never
 * references or mutates any existing engine; it only records a signal about a
 * target so admins can review, resolve or remove it.
 */

export const MODERATION_TARGET_TYPES = [
  "post",
  "comment",
  "chat",
  "market",
  "auction",
  "trade",
  "showcase",
  "group",
  "profile",
] as const

export const MODERATION_SEVERITIES = ["low", "medium", "high", "critical"] as const

const ModerationEventSchema = new Schema(
  {
    // The user the flagged content/account belongs to (author/owner).
    userId: { type: String, required: true, index: true },
    username: { type: String, default: "", trim: true },

    targetType: { type: String, enum: MODERATION_TARGET_TYPES, required: true, index: true },
    targetId: { type: String, default: "", index: true },

    severity: { type: String, enum: MODERATION_SEVERITIES, default: "low", index: true },

    /** Short machine category, e.g. "spam", "scam", "toxic", "prohibited". */
    category: { type: String, default: "other", index: true },
    /** Human-readable reason shown to admins (Italian, presentational). */
    reason: { type: String, default: "", trim: true },
    /** A short snippet of the offending content, for admin context. */
    excerpt: { type: String, default: "", trim: true },

    /** 0..1 AI/heuristic confidence that the content is problematic. */
    aiScore: { type: Number, default: 0, min: 0, max: 1 },
    /** Whether the automatic pipeline already hid/removed the content. */
    autoActioned: { type: Boolean, default: false },

    resolved: { type: Boolean, default: false, index: true },
    resolvedBy: { type: String, default: null },
    resolvedAt: { type: Date, default: null },
    /** "resolved" (dismissed/handled) or "removed" (content taken down). */
    resolution: { type: String, enum: ["resolved", "removed", null], default: null },
  },
  { timestamps: true },
)

// Common admin query: open events by severity, newest first.
ModerationEventSchema.index({ resolved: 1, severity: 1, createdAt: -1 })

const ModerationEvent = models.ModerationEvent || model("ModerationEvent", ModerationEventSchema)

export default ModerationEvent
