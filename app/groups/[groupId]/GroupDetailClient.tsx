"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Users, Loader2, ArrowLeft, Lock } from "lucide-react"
import GroupPostComposer from "@/components/groups/GroupPostComposer"
import GroupPostCard, { type GroupPostDTO } from "@/components/groups/GroupPostCard"
import GroupChatPanel from "@/components/groups/GroupChatPanel"
import CollexSpark from "@/components/collexspark/CollexSpark"
import { chatFetch } from "@/lib/chat-client"

interface GroupDetail {
  id: string
  name: string
  description: string
  category: string
  coverImage: string
  privacy: "public" | "private"
  memberCount: number
  postCount: number
  isMember: boolean
  role: string | null
}

interface MemberDTO {
  userId: string
  name: string
  username: string
  avatar: string
  role: string
}

const TABS = [
  { key: "feed", label: "Feed" },
  { key: "chat", label: "Chat" },
  { key: "market", label: "Annunci" },
  { key: "members", label: "Membri" },
]

export default function GroupDetailClient({ groupId }: { groupId: string }) {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [group, setGroup] = useState<GroupDetail | null>(null)
  const [tab, setTab] = useState("feed")
  const [posts, setPosts] = useState<GroupPostDTO[]>([])
  const [members, setMembers] = useState<MemberDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [postsLoading, setPostsLoading] = useState(false)
  const [joining, setJoining] = useState(false)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const t = localStorage.getItem("token")
    if (!t) {
      router.replace("/login")
      return
    }
    chatFetch<{ success: boolean; user?: { id: string } }>("/api/auth/me")
      .then((res) => {
        if (res.success && res.user) setUserId(res.user.id)
      })
      .catch(() => setUserId(null))
  }, [router])

  const loadGroup = useCallback(async () => {
    try {
      const d = await chatFetch<{ success: boolean; group?: GroupDetail }>(`/api/groups/${groupId}`)
      if (d.success && d.group) setGroup(d.group)
      else setNotFound(true)
    } catch {
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [groupId])

  const loadPosts = useCallback(
    async (kind?: string) => {
      setPostsLoading(true)
      try {
        const params = new URLSearchParams()
        if (kind) params.set("kind", kind)
        const d = await chatFetch<{ success: boolean; posts?: GroupPostDTO[] }>(
          `/api/groups/${groupId}/posts?${params.toString()}`,
        )
        setPosts(d.success ? d.posts || [] : [])
      } catch {
        setPosts([])
      } finally {
        setPostsLoading(false)
      }
    },
    [groupId],
  )

  const loadMembers = useCallback(async () => {
    try {
      const d = await chatFetch<{ success: boolean; members?: MemberDTO[] }>(`/api/groups/${groupId}/members`)
      setMembers(d.success ? d.members || [] : [])
    } catch {
      setMembers([])
    }
  }, [groupId])

  useEffect(() => {
    loadGroup()
  }, [loadGroup])

  useEffect(() => {
    if (!group?.isMember) return
    if (tab === "feed") loadPosts()
    else if (tab === "market") loadPosts("sale,trade")
    else if (tab === "members") loadMembers()
  }, [tab, group?.isMember, loadPosts, loadMembers])

  async function join() {
    setJoining(true)
    try {
      const d = await chatFetch<{ success: boolean }>(`/api/groups/${groupId}/join`, { method: "POST" })
      if (d.success) await loadGroup()
    } catch {
      // ignore
    } finally {
      setJoining(false)
    }
  }

  async function leave() {
    if (!confirm("Vuoi davvero lasciare questo gruppo?")) return
    try {
      const d = await chatFetch<{ success: boolean }>(`/api/groups/${groupId}/leave`, { method: "POST" })
      if (d.success) await loadGroup()
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="animate-spin" />
      </div>
    )
  }

  if (notFound || !group) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <CollexSpark pose="alert" size="lg" message="Questo gruppo non esiste o è stato rimosso." />
        <Link href="/groups" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
          ← Torna ai gruppi
        </Link>
      </div>
    )
  }

  const canSeeContent = group.isMember || group.privacy === "public"
  const marketPosts = posts.filter((p) => p.kind === "sale" || p.kind === "trade")

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <Link href="/groups" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft width={16} height={16} />
        Gruppi
      </Link>

      {/* Header */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="relative h-36 w-full bg-muted sm:h-48">
          {group.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={group.coverImage || "/placeholder.svg"} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-primary/15 to-accent/20" />
          )}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3 p-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">{group.name}</h1>
              {group.privacy === "private" ? <Lock width={16} height={16} className="text-muted-foreground" /> : null}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{group.description}</p>
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="rounded-full bg-muted px-2 py-0.5">{group.category || "Generale"}</span>
              <span className="inline-flex items-center gap-1">
                <Users width={14} height={14} />
                {group.memberCount} membri
              </span>
              <span>{group.postCount} post</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {group.isMember ? (
              group.role === "owner" ? (
                <span className="rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">Amministratore</span>
              ) : (
                <button
                  type="button"
                  onClick={leave}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
                >
                  Lascia
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={join}
                disabled={joining}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {joining ? <Loader2 className="animate-spin" width={16} height={16} /> : null}
                {group.privacy === "private" ? "Richiedi di entrare" : "Unisciti"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Not a member of a private group */}
      {!canSeeContent ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border py-16 text-center">
          <CollexSpark pose="happy" size="md" message="Questo è un gruppo privato. Unisciti per vedere feed, chat e annunci." />
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="mt-6 flex items-center gap-2 border-b border-border">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  tab === t.key
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-5">
            {tab === "feed" ? (
              <div className="flex flex-col gap-4">
                {group.isMember ? <GroupPostComposer groupId={groupId} onCreated={() => loadPosts()} /> : null}
                {postsLoading ? (
                  <div className="flex justify-center py-12 text-muted-foreground">
                    <Loader2 className="animate-spin" />
                  </div>
                ) : posts.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border py-12 text-center text-muted-foreground">
                    Ancora nessun post. {group.isMember ? "Inizia tu la conversazione!" : ""}
                  </p>
                ) : (
                  posts.map((p) => <GroupPostCard key={p.id} groupId={groupId} post={p} />)
                )}
              </div>
            ) : null}

            {tab === "chat" ? (
              group.isMember ? (
                <GroupChatPanel groupId={groupId} currentUserId={userId || ""} />
              ) : (
                <p className="rounded-xl border border-dashed border-border py-12 text-center text-muted-foreground">
                  Unisciti al gruppo per partecipare alla chat.
                </p>
              )
            ) : null}

            {tab === "market" ? (
              postsLoading ? (
                <div className="flex justify-center py-12 text-muted-foreground">
                  <Loader2 className="animate-spin" />
                </div>
              ) : marketPosts.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border py-12 text-center text-muted-foreground">
                  Nessun annuncio di vendita o scambio al momento.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {marketPosts.map((p) => (
                    <GroupPostCard key={p.id} groupId={groupId} post={p} />
                  ))}
                </div>
              )
            ) : null}

            {tab === "members" ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {members.map((m) => (
                  <li key={m.userId}>
                    <Link
                      href={`/u/${m.username}`}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 transition-colors hover:bg-accent"
                    >
                      {m.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.avatar || "/placeholder.svg"} alt="" className="h-9 w-9 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                          {(m.name || "?").charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{m.name}</p>
                        <p className="truncate text-xs text-muted-foreground">@{m.username}</p>
                      </div>
                      {m.role !== "member" ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                          {m.role === "owner" ? "Admin" : m.role}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}
