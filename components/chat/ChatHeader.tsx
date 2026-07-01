"use client"

import Link from "next/link"
import { ArrowLeft, Ban, ShieldCheck, Circle } from "lucide-react"
import type { ChatThreadDTO, ChatUserDTO } from "@/lib/chat-client"
import ChatContextBadge from "./ChatContextBadge"

export default function ChatHeader({
  thread,
  otherUser,
  blocked,
  online,
  onBlock,
  onUnblock,
  backHref = "/chat",
}: {
  thread: ChatThreadDTO | null
  otherUser: ChatUserDTO | null
  blocked: boolean
  online?: boolean
  onBlock: () => void
  onUnblock: () => void
  backHref?: string
}) {
  return (
    <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
      <Link
        href={backHref}
        className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
        aria-label="Torna alle chat"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>

      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
        {otherUser?.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={otherUser.avatar || "/placeholder.svg"} alt={otherUser.username} className="h-full w-full object-cover" />
        ) : (
          (otherUser?.username || "?").charAt(0).toUpperCase()
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{otherUser?.username || "Utente"}</p>
          {thread && <ChatContextBadge type={thread.type} label={thread.contextLabel || undefined} />}
        </div>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Circle className={`h-2 w-2 ${online ? "fill-primary text-primary" : "fill-muted-foreground/40 text-muted-foreground/40"}`} />
          {online ? "Online" : "Offline"}
        </p>
      </div>

      {otherUser &&
        (blocked ? (
          <button
            type="button"
            onClick={onUnblock}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
          >
            <ShieldCheck className="h-4 w-4" /> Sblocca
          </button>
        ) : (
          <button
            type="button"
            onClick={onBlock}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
          >
            <Ban className="h-4 w-4" /> Blocca
          </button>
        ))}
    </header>
  )
}
