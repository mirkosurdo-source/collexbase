import { Schema, models, model, type Model } from "mongoose"

/**
 * Blocco 24 — Wishlist Intelligente.
 *
 * A flat, per-item wishlist document (one row per desired item) with the rich
 * matching attributes required to monitor marketplace, trades and auctions.
 *
 * This is a NEW, separate collection from the legacy embedded `Wishlist`
 * (keyword market alerts) — both coexist without interference.
 */
export interface IWishlistEntry {
  userId: string
  itemName: string
  category: string
  series: string | null
  set: string | null
  rarity: string | null
  number: string | null
  minCondition: string | null
  maxPrice: number | null
  /** Per-entry CollexSpark alert toggle. */
  notifyEnabled: boolean
  createdAt: Date
  updatedAt: Date
}

const WishlistEntrySchema = new Schema<IWishlistEntry>(
  {
    userId: { type: String, required: true, index: true },
    itemName: { type: String, required: true, trim: true },
    category: { type: String, default: "", trim: true, index: true },
    series: { type: String, default: null, trim: true },
    set: { type: String, default: null, trim: true },
    rarity: { type: String, default: null, trim: true },
    number: { type: String, default: null, trim: true },
    minCondition: { type: String, default: null, trim: true },
    maxPrice: { type: Number, default: null },
    notifyEnabled: { type: Boolean, default: true },
  },
  { timestamps: true },
)

// Speeds up per-user listing and duplicate checks.
WishlistEntrySchema.index({ userId: 1, itemName: 1, category: 1 })

const WishlistEntry =
  (models.WishlistEntry as Model<IWishlistEntry>) || model<IWishlistEntry>("WishlistEntry", WishlistEntrySchema)

export default WishlistEntry
