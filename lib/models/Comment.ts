import { Schema, models, model } from "mongoose"

/**
 * A comment on a Post. Replies are modeled with `parentId` pointing at another
 * comment (single level of threading). `mentions` stores referenced usernames.
 */
const CommentSchema = new Schema(
  {
    postId: { type: Schema.Types.ObjectId, ref: "Post", required: true, index: true },
    parentId: { type: Schema.Types.ObjectId, ref: "Comment", default: null, index: true },

    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    authorUsername: { type: String, default: "", trim: true },
    authorAvatar: { type: String, default: "", trim: true },

    body: { type: String, required: true, trim: true },
    mentions: { type: [String], default: [] },

    likes: { type: [String], default: [] },
    likeCount: { type: Number, default: 0 },
  },
  { timestamps: true },
)

CommentSchema.index({ postId: 1, createdAt: 1 })

const Comment = models.Comment || model("Comment", CommentSchema)

export default Comment
