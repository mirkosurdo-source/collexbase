import { Schema, model, models } from "mongoose"

/**
 * Blocco 22 — AI Advisor (CollexSpark) cache.
 *
 * Stores the latest computed insights and the user's advisor preferences so the
 * /advisor dashboard can render instantly and background refreshes can diff
 * against the previous run to emit smart notifications. `insights` buckets are
 * intentionally loose (Mixed) because each generator owns its own shape.
 */
const InsightsSchema = new Schema(
  {
    collection: { type: [Schema.Types.Mixed], default: [] },
    marketplace: { type: [Schema.Types.Mixed], default: [] },
    trades: { type: [Schema.Types.Mixed], default: [] },
    auctions: { type: [Schema.Types.Mixed], default: [] },
    wishlist: { type: [Schema.Types.Mixed], default: [] },
    trends: { type: [Schema.Types.Mixed], default: [] },
  },
  { _id: false },
)

const PreferencesSchema = new Schema(
  {
    categories: { type: [String], default: [] },
    budget: { type: Number, default: null },
    favoriteSets: { type: [String], default: [] },
    favoriteSeries: { type: [String], default: [] },
    searchHistory: { type: [String], default: [] },
  },
  { _id: false },
)

const AIAdvisorSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    insights: { type: InsightsSchema, default: () => ({}) },
    preferences: { type: PreferencesSchema, default: () => ({}) },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
)

const AIAdvisor = models.AIAdvisor || model("AIAdvisor", AIAdvisorSchema)

export default AIAdvisor
