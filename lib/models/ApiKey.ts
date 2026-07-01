import { Schema, models, model } from "mongoose"

/**
 * A developer API key (Blocco 38). The raw key is shown to the user only once
 * at creation time; only a SHA-256 hash is persisted. `keyPrefix` stores the
 * first few visible characters (e.g. "cxb_live_a1b2…") for display in the UI.
 */
const ApiKeySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    label: { type: String, default: "", trim: true },

    // SHA-256 hash of the raw key; the raw key is never stored.
    keyHash: { type: String, required: true, unique: true, index: true },
    keyPrefix: { type: String, default: "", trim: true },

    // Granular scopes, e.g. "read:collection", "read:market", "write:webhook".
    scopes: { type: [String], default: [] },

    active: { type: Boolean, default: true, index: true },
    revokedAt: { type: Date, default: null },

    // Usage tracking.
    callCount: { type: Number, default: 0 },
    // Subset of callCount made against analytics endpoints (Blocco 38 badges).
    analyticsCallCount: { type: Number, default: 0 },
    lastUsedAt: { type: Date, default: null },

    // Fixed-window rate limit state (per key).
    windowStart: { type: Date, default: null },
    windowCount: { type: Number, default: 0 },
    rateLimitPerMin: { type: Number, default: 60 },
  },
  { timestamps: true },
)

const ApiKey = models.ApiKey || model("ApiKey", ApiKeySchema)

export default ApiKey
