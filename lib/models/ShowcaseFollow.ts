import { Schema, models, model } from "mongoose"

/**
 * Blocco 32 — "Segui vetrina".
 *
 * Separate from the seller-based Follow model: this tracks following a user's
 * public showcase specifically, so showcase follower counts and notifications
 * stay independent from generic seller follows.
 */
const ShowcaseFollowSchema = new Schema(
  {
    followerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // The owner of the followed showcase.
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    ownerUsername: { type: String, default: "", trim: true },
  },
  { timestamps: true },
)

ShowcaseFollowSchema.index({ followerId: 1, ownerId: 1 }, { unique: true })

const ShowcaseFollow = models.ShowcaseFollow || model("ShowcaseFollow", ShowcaseFollowSchema)

export default ShowcaseFollow
