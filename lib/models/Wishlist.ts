import { Schema, models, model } from "mongoose"

const WishlistItemSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, default: "", trim: true },
    targetPrice: { type: Number, default: 0 },
    note: { type: String, default: "", trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
)

const WishlistSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    items: { type: [WishlistItemSchema], default: [] },
  },
  { timestamps: true },
)

const Wishlist = models.Wishlist || model("Wishlist", WishlistSchema)

export default Wishlist
