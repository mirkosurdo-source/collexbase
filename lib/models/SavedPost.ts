import { Schema, models, model } from "mongoose"

const SavedPostSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    postId: { type: Schema.Types.ObjectId, ref: "Post", required: true, index: true },
  },
  { timestamps: true },
)

SavedPostSchema.index({ userId: 1, postId: 1 }, { unique: true })

const SavedPost = models.SavedPost || model("SavedPost", SavedPostSchema)

export default SavedPost
