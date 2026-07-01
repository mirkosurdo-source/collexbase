import { Schema, model, models } from "mongoose"

/**
 * Blocco 30 — An invitation to join a (typically private) group. Accepting an
 * invite creates the GroupMember edge; declining marks it resolved.
 */
const GroupInviteSchema = new Schema(
  {
    groupId: { type: Schema.Types.ObjectId, ref: "Group", required: true, index: true },
    groupName: { type: String, default: "" },
    invitedUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    invitedByUsername: { type: String, default: "" },
    status: { type: String, enum: ["pending", "accepted", "declined"], default: "pending", index: true },
  },
  { timestamps: true },
)

GroupInviteSchema.index({ groupId: 1, invitedUserId: 1 }, { unique: true })
GroupInviteSchema.index({ invitedUserId: 1, status: 1 })

const GroupInvite = models.GroupInvite || model("GroupInvite", GroupInviteSchema)

export default GroupInvite
