import mongoose, { Schema, models, model } from "mongoose"

// Blocco 51.1 — gated Creator Partner applications. A user submits social
// proof; an admin reviews and, on approval, the creator is activated through
// the existing activateCreator() engine.
const CreatorApplicationSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    socialLinks: { type: [String], default: [] },
    instagramUrl: { type: String, default: "", trim: true },
    tiktokUrl: { type: String, default: "", trim: true },
    followerCountInstagram: { type: Number, default: null },
    followerCountTikTok: { type: Number, default: null },
    message: { type: String, default: "", trim: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    reviewedBy: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
    // Reason shown to the user on rejection (or auto-rejection).
    decisionNote: { type: String, default: "" },
  },
  { timestamps: true },
)

// Most queries list newest-first, optionally filtered by status.
CreatorApplicationSchema.index({ status: 1, createdAt: -1 })

const CreatorApplication = models.CreatorApplication || model("CreatorApplication", CreatorApplicationSchema)

export default CreatorApplication
