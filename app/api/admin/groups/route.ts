import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import Group from "@/lib/models/Group"
import GroupMember from "@/lib/models/GroupMember"
import GroupPost from "@/lib/models/GroupPost"
import GroupMessage from "@/lib/models/GroupMessage"
import GroupInvite from "@/lib/models/GroupInvite"

export const dynamic = "force-dynamic"

/** Admin group moderation: search, filter by category/privacy, paginate. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    await connectDB()
    const url = new URL(req.url)
    const q = (url.searchParams.get("q") || "").trim()
    const category = url.searchParams.get("category") || ""
    const privacy = url.searchParams.get("privacy") || ""
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1)
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 20))

    const filter: Record<string, unknown> = {}
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { category: { $regex: q, $options: "i" } },
      ]
    }
    if (category) filter.category = category
    if (privacy === "public" || privacy === "private") filter.privacy = privacy

    const [total, groups, totals, catAgg] = await Promise.all([
      Group.countDocuments(filter),
      Group.find(filter)
        .select("name category privacy memberCount postCount ownerId image createdAt")
        .sort({ memberCount: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Group.aggregate([
        { $group: { _id: null, total: { $sum: 1 }, members: { $sum: "$memberCount" }, posts: { $sum: "$postCount" } } },
      ]),
      Group.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    ])

    // Resolve owner usernames in a single query.
    const ownerIds = [...new Set(groups.map((g) => String(g.ownerId)).filter(Boolean))]
    const owners = ownerIds.length
      ? await User.find({ _id: { $in: ownerIds } }).select("username").lean()
      : []
    const ownerMap = new Map(owners.map((u) => [String(u._id), u.username as string]))

    const rows = groups.map((g) => ({
      id: String(g._id),
      name: g.name,
      category: g.category,
      privacy: g.privacy,
      memberCount: g.memberCount ?? 0,
      postCount: g.postCount ?? 0,
      owner: ownerMap.get(String(g.ownerId)) || "—",
      createdAt: g.createdAt,
    }))

    return NextResponse.json({
      success: true,
      groups: rows,
      total,
      page,
      pages: Math.ceil(total / limit),
      stats: {
        total: totals[0]?.total ?? 0,
        members: totals[0]?.members ?? 0,
        posts: totals[0]?.posts ?? 0,
        topCategory: catAgg[0]?._id ?? "—",
      },
    })
  } catch (err) {
    console.error("[v0] admin/groups GET error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}

/** Delete a group and all of its members, posts, messages and invites. */
export async function DELETE(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    await connectDB()
    const url = new URL(req.url)
    const id = url.searchParams.get("id")
    if (!id) return NextResponse.json({ success: false, message: "ID mancante." }, { status: 400 })

    const group = await Group.findById(id).select("_id").lean<{ _id?: unknown } | null>()
    if (!group) return NextResponse.json({ success: false, message: "Gruppo non trovato." }, { status: 404 })

    await Promise.all([
      Group.deleteOne({ _id: id }),
      GroupMember.deleteMany({ groupId: id }),
      GroupPost.deleteMany({ groupId: id }),
      GroupMessage.deleteMany({ groupId: id }),
      GroupInvite.deleteMany({ groupId: id }),
    ])

    return NextResponse.json({ success: true, message: "Gruppo eliminato." })
  } catch (err) {
    console.error("[v0] admin/groups DELETE error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
