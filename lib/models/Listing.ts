import { Schema, models, model } from "mongoose"

const ListingSchema = new Schema(
  {
    sellerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sellerUsername: { type: String, default: "", trim: true },
    sellerBadge: { type: String, enum: ["Base", "Gold", "Premium"], default: "Base" },

    itemName: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    category: { type: String, default: "", trim: true, index: true },
    condition: { type: String, default: "", trim: true },
    rarity: { type: String, default: "Comune", trim: true },
    year: { type: Number, default: null },
    value: { type: Number, default: 0 },

    image: { type: String, default: "", trim: true },
    photos: { type: [String], default: [] },

    price: { type: Number, required: true },
    aiSuggestedPrice: { type: Number, default: 0 },

    // Accepted deal modes.
    acceptsTrade: { type: Boolean, default: false },
    acceptsItemPlusCash: { type: Boolean, default: false },
    acceptsItemPlusCoins: { type: Boolean, default: false },

    status: { type: String, enum: ["active", "pending", "sold", "cancelled"], default: "active", index: true },
    savedCount: { type: Number, default: 0 },
    viewsCount: { type: Number, default: 0 },
    soldTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
)

// Blocco 50 — hottest marketplace query: filter by status and sort by recency.
ListingSchema.index({ status: 1, createdAt: -1 })
// Seller's own listings filtered by status (dashboard / profile views).
ListingSchema.index({ sellerId: 1, status: 1 })

const Listing = models.Listing || model("Listing", ListingSchema)

export default Listing
