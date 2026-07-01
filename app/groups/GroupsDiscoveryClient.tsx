"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Loader2, Search } from "lucide-react"
import GroupCard, { type GroupSummary } from "@/components/groups/GroupCard"
import CreateGroupDialog from "@/components/groups/CreateGroupDialog"
import CollexSpark from "@/components/collexspark/CollexSpark"
import { chatFetch } from "@/lib/chat-client"
import { CATEGORIES } from "@/lib/collection-helpers"

const SORTS = [
  { key: "popular", label: "Popolari" },
  { key: "new", label: "Nuovi" },
  { key: "active", label: "Più attivi" },
]

export default function GroupsDiscoveryClient() {
  const router = useRouter()
  const [authed, setAuthed] = useState(false)
  const [recommended, setRecommended] = useState<GroupSummary[]>([])
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [sort, setSort] = useState("popular")
  const [category, setCategory] = useState("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    const t = localStorage.getItem("token")
    if (!t) {
      router.replace("/login")
      return
    }
    setAuthed(true)
    chatFetch<{ success: boolean; groups?: GroupSummary[] }>("/api/groups/recommended")
      .then((d) => {
        if (d.success) setRecommended(d.groups || [])
      })
      .catch(() => {})
  }, [router])

  const load = useCallback(async () => {
    if (!authed) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ sort })
      if (category) params.set("category", category)
      if (search.trim()) params.set("q", search.trim())
      const d = await chatFetch<{ success: boolean; groups?: GroupSummary[] }>(`/api/groups?${params.toString()}`)
      setGroups(d.success ? d.groups || [] : [])
    } catch {
      setGroups([])
    } finally {
      setLoading(false)
    }
  }, [authed, sort, category, search])

  useEffect(() => {
    const id = setTimeout(load, search ? 300 : 0)
    return () => clearTimeout(id)
  }, [load, search])

  if (!authed) return null

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <CollexSpark pose="happy" size="lg" still />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gruppi</h1>
            <p className="text-sm text-muted-foreground">
              Unisciti a community tematiche per discutere, scambiare e mostrare i tuoi pezzi.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus width={16} height={16} />
          Crea gruppo
        </button>
      </header>

      {/* Recommended */}
      {recommended.length > 0 ? (
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <CollexSpark pose="trend" size="sm" still />
            <h2 className="text-lg font-semibold text-foreground">Consigliati per te</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recommended.map((g) => (
              <GroupCard key={g.id} group={g} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Search + filters */}
      <div className="mb-5 flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" width={16} height={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca gruppi…"
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>
        <div className="flex items-center gap-2 border-b border-border">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSort(s.key)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                sort === s.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategory("")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              category === "" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            Tutte
          </button>
          {CATEGORIES.map((c: string) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                category === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="animate-spin" />
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          <p>Nessun gruppo trovato.</p>
          <p className="mt-1 text-sm">Perché non crei tu il primo su questo tema?</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <GroupCard key={g.id} group={g} />
          ))}
        </div>
      )}

      {showCreate ? <CreateGroupDialog onClose={() => setShowCreate(false)} /> : null}
    </div>
  )
}
