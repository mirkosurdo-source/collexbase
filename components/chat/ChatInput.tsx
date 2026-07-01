"use client"

import { useState } from "react"
import { Send, X, FileText, Loader2 } from "lucide-react"
import ChatAttachmentUploader from "./ChatAttachmentUploader"
import type { ChatAttachment } from "@/lib/chat-client"

export default function ChatInput({
  threadId,
  disabled,
  disabledReason,
  onSend,
}: {
  threadId?: string
  disabled?: boolean
  disabledReason?: string
  onSend: (text: string, attachments: ChatAttachment[]) => Promise<boolean>
}) {
  const [text, setText] = useState("")
  const [pending, setPending] = useState<ChatAttachment[]>([])
  const [sending, setSending] = useState(false)

  async function submit() {
    const trimmed = text.trim()
    if ((!trimmed && pending.length === 0) || sending) return
    setSending(true)
    const ok = await onSend(trimmed, pending)
    setSending(false)
    if (ok) {
      setText("")
      setPending([])
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Respect IME composition (CJK) before submitting on Enter.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
      e.preventDefault()
      void submit()
    }
  }

  if (disabled) {
    return (
      <div className="border-t border-border bg-card px-4 py-3 text-center text-sm text-muted-foreground">
        {disabledReason || "Non puoi inviare messaggi in questa conversazione."}
      </div>
    )
  }

  return (
    <div className="border-t border-border bg-card px-3 py-2">
      {pending.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {pending.map((a, i) => (
            <div key={i} className="flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-1 text-xs text-secondary-foreground">
              <FileText className="h-3 w-3" />
              <span className="max-w-[120px] truncate">{a.name || "File"}</span>
              <button type="button" onClick={() => setPending((p) => p.filter((_, j) => j !== i))} aria-label="Rimuovi allegato">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-1">
        <ChatAttachmentUploader threadId={threadId} onUploaded={(a) => setPending((p) => [...p, a])} disabled={sending} />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Scrivi un messaggio…"
          className="max-h-32 min-h-9 flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="button"
          onClick={submit}
          disabled={sending || (!text.trim() && pending.length === 0)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          aria-label="Invia messaggio"
        >
          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </button>
      </div>
    </div>
  )
}
