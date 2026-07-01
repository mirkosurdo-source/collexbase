import { Schema, model, models } from "mongoose"

/**
 * Blocco 30 — A post inside a group feed. Separate from the community Post
 * engine. `postType` lets a single feed carry discussions plus lightweight
 * group-internal trades/auctions (price/details denormalized here) without
 * touching the real Marketplace/Auction/Trade engines.
 */
const GroupPostSchema = new Schema(
  {
    groupId: { type: Schema.Types.ObjectId, ref: "Group", required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    authorUsername: { type: String, default: "" },
    authorAvatar: { type: String, default: "" },

    postType: { type: String, enum: ["discussion", "trade", "auction"], default: "discussion", index: true },
    body: { type: String, default: "", trim: true },
    images: { type: [String], default: [] },

    // Optional fields for trade/auction posts (presentational only).
    itemName: { type: String, default: "" },
    price: { type: Number, default: 0 },

    likes: { type: [String], default: [] },
    likeCount: { type: Number, default: 0, index: true },
    commentCount: { type: Number, default: 0 },
  },
  { timestamps: true },
)

GroupPostSchema.index({ groupId: 1, createdAt: -1 })
GroupPostSchema.index({ groupId: 1, postType: 1, createdAt: -1 })

const GroupPost = models.GroupPost || model("GroupPost", GroupPostSchema)

export default GroupPost
