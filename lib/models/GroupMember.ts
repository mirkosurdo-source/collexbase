import { Schema, model, models } from "mongoose"

/**
 * Blocco 30 — Membership edge between a user and a group.
 * One document per (groupId, userId). `role` distinguishes admins from members.
 */
const GroupMemberSchema = new Schema(
  {
    groupId: { type: Schema.Types.ObjectId, ref: "Group", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: { type: String, enum: ["owner", "admin", "member"], default: "member", index: true },

    // Denormalized identity for fast member lists.
    username: { type: String, default: "" },
    avatar: { type: String, default: "" },

    // Per-group contribution counter (drives the "Membro Attivo" badge).
    postCount: { type: Number, default: 0 },
    messageCount: { type: Number, default: 0 },
  },
  { timestamps: true },
)

GroupMemberSchema.index({ groupId: 1, userId: 1 }, { unique: true })
GroupMemberSchema.index({ userId: 1, createdAt: -1 })

const GroupMember = models.GroupMember || model("GroupMember", GroupMemberSchema)

export default GroupMember
