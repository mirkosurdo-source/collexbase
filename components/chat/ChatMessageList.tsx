"use client"

import { useEffect, useRef } from "react"
import { FileText, Check, CheckCheck } from "lucide-react"
import { formatTime, type ChatMessageDTO } from "@/lib/chat-client"

function isImage(contentType?: string) {
  return !!contentType && contentType.startsWith("image/")
}

export default function ChatMessageList({
  messages,
  currentUserId,
  otherInThreadCount = 1,
}: {
  messages: ChatMessageDTO[]
  currentUserId: string
  otherInThreadCount?: number
}) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
        Nessun messaggio. Scrivi per iniziare la conversazione.
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
      {messages.map((m) => {
        const mine = m.senderId === currentUserId
        const read = mine && m.readBy.filter((r) => r !== currentUserId).length >= otherInThreadCount
        return (
          <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${
                mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-secondary text-secondary-foreground"
              }`}
            >
              {m.deleted ? (
                <p className="italic opacity-70">Messaggio rimosso da un moderatore</p>
              ) : (
                <>
                  {m.attachments.map((a, i) =>
                    isImage(a.contentType) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={a.url || "/placeholder.svg"}
                        alt={a.name || "allegato"}
                        className="mb-1 max-h-60 w-auto rounded-lg"
                      />
                    ) : (
                      <a
                        key={i}
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mb-1 flex items-center gap-2 rounded-lg bg-background/20 px-2 py-1.5 underline-offset-2 hover:underline"
                      >
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="truncate">{a.name || "File"}</span>
                      </a>
                    ),
                  )}
                  {m.text && <p className="whitespace-pre-wrap break-words leading-relaxed">{m.text}</p>}
                </>
              )}
              <div className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                {formatTime(m.createdAt)}
                {mine && !m.deleted && (read ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />)}
              </div>
            </div>
          </div>
        )
      })}
      <div ref={endRef} />
    </div>
  )
}
