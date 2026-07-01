import { Schema, models, model } from "mongoose"

const SnapshotSchema = new Schema(
  {
    label: { type: String, default: "" },
    value: { type: Number, default: 0 },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
)

/**
 * Cached reputation for a user. Recomputed by lib/reputation.ts from reviews,
 * sales, trades and community activity. `history` stores periodic snapshots
 * used to render the reputation trend chart.
 */
const ReputationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    score: { type: Number, default: 0 },
    tier: { type: String, default: "Nuovo" },

    avgRating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    salesCount: { type: Number, default: 0 },
    tradesCount: { type: Number, default: 0 },
    communityPoints: { type: Number, default: 0 },

    history: { type: [SnapshotSchema], default: [] },
    computedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
)

const Reputation = models.Reputation || model("Reputation", ReputationSchema)

export default Reputation
