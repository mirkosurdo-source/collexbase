import { Schema, models, model } from "mongoose"

/**
 * Blocco 41 — a professional inventory item owned by a Pro seller.
 *
 * Each published item is mirrored into the base `Listing` collection (via a
 * linked listingId) so it appears in the normal marketplace without changing
 * the base marketplace logic. Unpublishing removes the mirrored listing.
 */
const SellerInventoryItemSchema = new Schema(
  {
    sellerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    cardId: { type: String, default: "", trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    category: { type: String, default: "", trim: true },
    condition: { type: String, default: "", trim: true },

    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, default: 1, min: 0 },

    images: { type: [String], default: [] },

    // Mirrored base-marketplace listing (null when unpublished).
    published: { type: Boolean, default: false, index: true },
    listingId: { type: Schema.Types.ObjectId, ref: "Listing", default: null },
  },
  { timestamps: true },
)

const SellerInventoryItem =
  models.SellerInventoryItem || model("SellerInventoryItem", SellerInventoryItemSchema)

export default SellerInventoryItem
