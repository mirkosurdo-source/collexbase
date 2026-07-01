"use client"

import Link from "next/link"
import { Users, MessageSquare } from "lucide-react"

export interface GroupSummary {
  id: string
  name: string
  slug: string
  description: string
  category: string
  coverImage: string
  privacy: "public" | "private"
  memberCount: number
  postCount: number
  isMember?: boolean
  role?: string | null
}

export default function GroupCard({ group }: { group: GroupSummary }) {
  return (
    <Link
      href={`/groups/${group.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/40"
    >
      <div className="relative h-28 w-full overflow-hidden bg-muted">
        {group.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={group.coverImage || "/placeholder.svg"}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-accent/20">
            <Users className="text-primary/40" width={32} height={32} />
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-medium text-foreground backdrop-blur">
          {group.category || "Generale"}
        </span>
        {group.privacy === "private" ? (
          <span className="absolute right-2 top-2 rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-medium text-muted-foreground backdrop-blur">
            Privato
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 font-semibold text-foreground">{group.name}</h3>
          {group.isMember ? (
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              Iscritto
            </span>
          ) : null}
        </div>
        <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted-foreground">{group.description || "Nessuna descrizione."}</p>
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users width={14} height={14} />
            {group.memberCount} {group.memberCount === 1 ? "membro" : "membri"}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageSquare width={14} height={14} />
            {group.postCount} post
          </span>
        </div>
      </div>
    </Link>
  )
}
