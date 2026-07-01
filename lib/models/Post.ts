import { Schema, models, model } from "mongoose"

/**
 * A community entry. `kind` separates the lightweight social feed ("post")
 * from long-form blog/forum entries ("blog"). Blog entries additionally use
 * `title` and a `blogType` (guide | discussion | help).
 */
const PostSchema = new Schema(
  {
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    authorUsername: { type: String, default: "", trim: true },
    authorAvatar: { type: String, default: "", trim: true },

    kind: { type: String, enum: ["post", "blog"], default: "post", index: true },
    blogType: { type: String, enum: ["guide", "discussion", "help", ""], default: "" },

    title: { type: String, default: "", trim: true },
    body: { type: String, default: "", trim: true },
    images: { type: [String], default: [] },

    category: { type: String, default: "", trim: true, index: true },
    tags: { type: [String], default: [] },
    visibility: { type: String, enum: ["public", "followers"], default: "public", index: true },

    // Denormalized engagement counters for fast sorting/feeds.
    likes: { type: [String], default: [] },
    likeCount: { type: Number, default: 0, index: true },
    commentCount: { type: Number, default: 0 },
    shareCount: { type: Number, default: 0 },
  },
  { timestamps: true },
)

PostSchema.index({ kind: 1, createdAt: -1 })
PostSchema.index({ kind: 1, likeCount: -1 })

const Post = models.Post || model("Post", PostSchema)

export default Post
