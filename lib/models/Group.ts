import { Schema, model, models } from "mongoose"

/**
 * Blocco 30 — Collector groups / clubs.
 *
 * A thematic group (club) of collectors. Fully additive: separate from the
 * community Post engine, the chat engine and every prior block. Group-internal
 * auctions/trades are modeled as typed GroupPosts (see GroupPost) so the real
 * Auction/Trade engines are never touched.
 */
const GroupSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    description: { type: String, default: "", trim: true },
    image: { type: String, default: "" },
    // Free-form thematic category (Pokémon, Magic, Funko, ...).
    category: { type: String, default: "", trim: true, index: true },
    privacy: { type: String, enum: ["public", "private"], default: "public", index: true },
    // Official CollexBase groups are created/curated by admins.
    official: { type: Boolean, default: false, index: true },
    // Group language (Blocco 26 locale code: it/en/es/fr/de/ru/zh).
    language: { type: String, default: "it" },

    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Member ids with admin powers (always includes the owner).
    adminIds: { type: [String], default: [] },

    // Denormalized counters for fast sorting/discovery.
    memberCount: { type: Number, default: 1, index: true },
    postCount: { type: Number, default: 0 },
    messageCount: { type: Number, default: 0 },
    lastActivityAt: { type: Date, default: Date.now, index: true },

    // Moderation (admin panel).
    status: { type: String, enum: ["active", "suspended"], default: "active", index: true },
    reportedBy: { type: [String], default: [] },
  },
  { timestamps: true },
)

GroupSchema.index({ name: "text", description: "text", category: "text" })
GroupSchema.index({ privacy: 1, memberCount: -1 })

const Group = models.Group || model("Group", GroupSchema)

export default Group
