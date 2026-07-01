import { Schema, models, model } from "mongoose"

/**
 * A reputation review left by one user about another, scoped to a transaction
 * context: a sale (seller), a purchase (buyer), or a trade.
 */
const ReviewSchema = new Schema(
  {
    targetUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    targetUsername: { type: String, default: "", trim: true },

    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    authorUsername: { type: String, default: "", trim: true },
    authorAvatar: { type: String, default: "", trim: true },

    type: { type: String, enum: ["seller", "buyer", "trade"], default: "seller", index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "", trim: true },

    // Optional reference to the transaction that justifies this review.
    refId: { type: String, default: "" },
  },
  { timestamps: true },
)

// One review per author -> target per transaction reference.
ReviewSchema.index({ authorId: 1, targetUserId: 1, refId: 1 }, { unique: false })

const Review = models.Review || model("Review", ReviewSchema)

export default Review
