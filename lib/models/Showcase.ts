import { Schema, models, model } from "mongoose"

/**
 * Blocco 32 — public showcase / vetrina.
 *
 * A lightweight, additive model that lets a user expose a themed selection of
 * their existing CollectionItem documents. It NEVER duplicates collection data:
 * `featuredItems` only stores ObjectId references resolved at read time.
 */
const ShowcaseSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    username: { type: String, default: "", trim: true, index: true },
    title: { type: String, default: "", trim: true },
    description: { type: String, default: "", trim: true },
    // Thematic label (Pokémon, Magic, Funko, …) — see SHOWCASE_THEMES.
    theme: { type: String, default: "Custom", trim: true, index: true },
    // public = indexed globally, private = visible to the user's groups only,
    // disabled = no exposure at all.
    visibility: { type: String, enum: ["public", "private", "disabled"], default: "disabled", index: true },
    // Ordered references to the user's own CollectionItem documents (max 12).
    featuredItems: { type: [Schema.Types.ObjectId], default: [] },
    // Denormalized counters kept in sync on read/update for cheap ranking.
    followerCount: { type: Number, default: 0, index: true },
    viewCount: { type: Number, default: 0 },
  },
  { timestamps: true },
)

ShowcaseSchema.index({ visibility: 1, followerCount: -1 })
ShowcaseSchema.index({ visibility: 1, theme: 1 })

const Showcase = models.Showcase || model("Showcase", ShowcaseSchema)

export default Showcase
