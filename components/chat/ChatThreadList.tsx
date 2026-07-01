"use client"

import { formatTime, type ChatThreadDTO } from "@/lib/chat-client"
import ChatContextBadge from "./ChatContextBadge"

export default function ChatThreadList({
  threads,
  activeId,
  onSelect,
  loading,
}: {
  threads: ChatThreadDTO[]
  activeId?: string
  onSelect: (t: ChatThreadDTO) => void
  loading?: boolean
}) {
  if (loading && threads.length === 0) {
    return <div className="p-6 text-center text-sm text-muted-foreground">Caricamento chat…</div>
  }
  if (threads.length === 0) {
    return <div className="p-6 text-center text-sm text-muted-foreground">Nessuna conversazione. Avvia una nuova chat privata.</div>
  }

  return (
    <ul className="divide-y divide-border">
      {threads.map((t) => {
        const active = t.id === activeId
        const unread = t.unreadCount || 0
        return (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => onSelect(t)}
              className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors ${
                active ? "bg-accent" : "hover:bg-accent/50"
              }`}
            >
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
                {t.otherUser?.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.otherUser.avatar || "/placeholder.svg"} alt={t.otherUser.username} className="h-full w-full object-cover" />
                ) : (
                  (t.otherUser?.username || "?").charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{t.otherUser?.username || "Utente"}</p>
                  {t.type !== "private" && <ChatContextBadge type={t.type} label={t.contextLabel || undefined} />}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {t.status === "suspended" ? "Conversazione sospesa" : t.lastMessageText || "Nessun messaggio"}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[10px] text-muted-foreground">{formatTime(t.lastMessageAt)}</span>
                {unread > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
