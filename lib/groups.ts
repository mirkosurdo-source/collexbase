import { connectDB } from "@/lib/db"
import Group from "@/lib/models/Group"
import GroupMember from "@/lib/models/GroupMember"
import Follow from "@/lib/models/Follow"
import CollectionItem from "@/lib/models/Collection"

export type GroupRole = "owner" | "admin" | "member" | null

export interface GroupDTO {
  id: string
  slug: string
  name: string
  description: string
  image: string
  /** Alias of `image` used by UI components (Blocco 30). */
  coverImage: string
  category: string
  privacy: "public" | "private"
  official: boolean
  language: string
  ownerId: string
  memberCount: number
  postCount: number
  messageCount: number
  status: string
  createdAt: string
  lastActivityAt: string
  /** Viewer-relative fields (filled when a userId is supplied). */
  role?: GroupRole
  isMember?: boolean
  isAdmin?: boolean
}

/** Serializes a lean Group doc into a stable DTO. */
export function toGroupDTO(g: Record<string, unknown>, role: GroupRole = null): GroupDTO {
  const adminIds = (g.adminIds as string[]) || []
  const image = String(g.image || "")
  return {
    id: String(g._id),
    slug: String(g._id),
    name: String(g.name || ""),
    description: String(g.description || ""),
    image,
    coverImage: image,
    category: String(g.category || ""),
    privacy: (g.privacy as "public" | "private") || "public",
    official: Boolean(g.official),
    language: String(g.language || "it"),
    ownerId: String(g.ownerId || ""),
    memberCount: Number(g.memberCount || 0),
    postCount: Number(g.postCount || 0),
    messageCount: Number(g.messageCount || 0),
    status: String(g.status || "active"),
    createdAt: g.createdAt ? new Date(g.createdAt as string).toISOString() : "",
    lastActivityAt: g.lastActivityAt ? new Date(g.lastActivityAt as string).toISOString() : "",
    role,
    isMember: role !== null,
    isAdmin: role === "owner" || role === "admin" || adminIds.includes(String(g.ownerId)),
  }
}

/** Returns the viewer's role in a group, or null if not a member. */
export async function getRole(groupId: string, userId: string | null): Promise<GroupRole> {
  if (!userId) return null
  await connectDB()
  const m = await GroupMember.findOne({ groupId, userId }).select("role").lean<{ role: GroupRole } | null>()
  return m?.role ?? null
}

/** Builds a map of groupId -> role for a set of groups (single query). */
export async function getRolesForUser(groupIds: string[], userId: string | null): Promise<Record<string, GroupRole>> {
  if (!userId || groupIds.length === 0) return {}
  await connectDB()
  const memberships = await GroupMember.find({ userId, groupId: { $in: groupIds } })
    .select("groupId role")
    .lean()
  const map: Record<string, GroupRole> = {}
  for (const m of memberships as Record<string, unknown>[]) {
    map[String(m.groupId)] = (m.role as GroupRole) ?? "member"
  }
  return map
}

/** Whether a viewer may read a group's content. */
export function canView(group: GroupDTO): boolean {
  return group.privacy === "public" || group.official || Boolean(group.isMember)
}

/** Badge-engine metrics derived from a user's group activity (Blocco 30). */
export interface GroupBadgeMetrics {
  groupPosts: number
  groupMembersLed: number
  groupsJoined: number
  groupMessages: number
}

export async function gatherGroupBadgeMetrics(userId: string): Promise<GroupBadgeMetrics> {
  await connectDB()
  const memberships = await GroupMember.find({ userId }).select("groupId role postCount messageCount").lean()

  let groupPosts = 0
  let groupMessages = 0
  const ledGroupIds: string[] = []
  for (const m of memberships as Record<string, unknown>[]) {
    groupPosts += Number(m.postCount || 0)
    groupMessages += Number(m.messageCount || 0)
    if (m.role === "owner" || m.role === "admin") ledGroupIds.push(String(m.groupId))
  }

  // The "Leader" metric is the largest administered group's member count.
  let groupMembersLed = 0
  if (ledGroupIds.length) {
    const led = await Group.find({ _id: { $in: ledGroupIds } }).select("memberCount").lean()
    for (const g of led as Record<string, unknown>[]) groupMembersLed = Math.max(groupMembersLed, Number(g.memberCount || 0))
  }

  return { groupPosts, groupMembersLed, groupsJoined: memberships.length, groupMessages }
}

/** Group activity stats for the profile "Gruppi" section. */
export interface UserGroupStats {
  joined: number
  administered: number
  totalPosts: number
  totalMessages: number
}

export async function gatherUserGroupStats(userId: string): Promise<UserGroupStats> {
  await connectDB()
  const memberships = await GroupMember.find({ userId }).select("role postCount messageCount").lean()
  let administered = 0
  let totalPosts = 0
  let totalMessages = 0
  for (const m of memberships as Record<string, unknown>[]) {
    if (m.role === "owner" || m.role === "admin") administered += 1
    totalPosts += Number(m.postCount || 0)
    totalMessages += Number(m.messageCount || 0)
  }
  return { joined: memberships.length, administered, totalPosts, totalMessages }
}

/** Groups the user belongs to, newest membership first. */
export async function getUserGroups(userId: string, limit = 50): Promise<(GroupDTO & { role: GroupRole })[]> {
  await connectDB()
  const memberships = await GroupMember.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("groupId role")
    .lean()
  const ids = memberships.map((m: Record<string, unknown>) => String(m.groupId))
  if (ids.length === 0) return []
  const roleById: Record<string, GroupRole> = {}
  for (const m of memberships as Record<string, unknown>[]) roleById[String(m.groupId)] = (m.role as GroupRole) ?? "member"
  const groups = await Group.find({ _id: { $in: ids }, status: "active" }).lean()
  return groups.map((g: Record<string, unknown>) => ({
    ...toGroupDTO(g, roleById[String(g._id)]),
    role: roleById[String(g._id)],
  }))
}

/**
 * Recommends groups for a user based on collection categories, followed users'
 * memberships and overall popularity. Used by /groups and the AI Advisor.
 * Excludes groups the user already belongs to. Read-only and engine-free.
 */
export async function recommendGroups(userId: string | null, limit = 8): Promise<GroupDTO[]> {
  await connectDB()

  let excludeIds: string[] = []
  let collectionCategories: string[] = []
  let followedGroupIds: string[] = []

  if (userId) {
    const memberships = await GroupMember.find({ userId }).select("groupId").lean()
    excludeIds = memberships.map((m: Record<string, unknown>) => String(m.groupId))

    // Categories the user collects most.
    const catAgg = await CollectionItem.aggregate([
      { $match: { userId: (await import("mongoose")).default.Types.ObjectId.createFromHexString(userId) } },
      { $group: { _id: "$category", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 5 },
    ]).catch(() => [])
    collectionCategories = (catAgg as Record<string, unknown>[]).map((c) => String(c._id || "")).filter(Boolean)

    // Groups that followed users belong to.
    const follows = await Follow.find({ followerId: userId }).select("sellerId").lean()
    const followedIds = follows.map((f: Record<string, unknown>) => String(f.sellerId))
    if (followedIds.length) {
      const followedMemberships = await GroupMember.find({ userId: { $in: followedIds } })
        .select("groupId")
        .limit(100)
        .lean()
      followedGroupIds = followedMemberships.map((m: Record<string, unknown>) => String(m.groupId))
    }
  }

  const baseFilter: Record<string, unknown> = {
    status: "active",
    privacy: "public",
  }
  if (excludeIds.length) baseFilter._id = { $nin: excludeIds }

  // Prefer matches on collected categories or followed-user groups, else popular.
  const orClauses: Record<string, unknown>[] = []
  if (collectionCategories.length) orClauses.push({ category: { $in: collectionCategories } })
  if (followedGroupIds.length) orClauses.push({ _id: { $in: followedGroupIds } })

  const filter = orClauses.length ? { ...baseFilter, $or: orClauses } : baseFilter

  let groups = await Group.find(filter).sort({ memberCount: -1, lastActivityAt: -1 }).limit(limit).lean()

  // Backfill with popular public groups if recommendations are sparse.
  if (groups.length < limit) {
    const have = new Set(groups.map((g: Record<string, unknown>) => String(g._id)))
    const extraExclude = [...excludeIds, ...Array.from(have)]
    const fill = await Group.find({ status: "active", privacy: "public", _id: { $nin: extraExclude } })
      .sort({ memberCount: -1 })
      .limit(limit - groups.length)
      .lean()
    groups = [...groups, ...fill]
  }

  return groups.map((g: Record<string, unknown>) => toGroupDTO(g))
}
