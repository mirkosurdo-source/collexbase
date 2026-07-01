import { Schema, models, model } from "mongoose"

const FollowSchema = new Schema(
  {
    followerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sellerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sellerUsername: { type: String, default: "", trim: true },
  },
  { timestamps: true },
)

FollowSchema.index({ followerId: 1, sellerId: 1 }, { unique: true })

const Follow = models.Follow || model("Follow", FollowSchema)

export default Follow
