"use client"

import { useRef, useState } from "react"
import { Paperclip, Loader2 } from "lucide-react"
import { uploadAttachment, type ChatAttachment } from "@/lib/chat-client"

export default function ChatAttachmentUploader({
  threadId,
  onUploaded,
  disabled,
}: {
  threadId?: string
  onUploaded: (att: ChatAttachment) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setError("")
    setUploading(true)
    try {
      const res = await uploadAttachment(file, threadId)
      if (res.success && res.attachment) {
        onUploaded(res.attachment)
      } else {
        setError(res.message || "Caricamento non riuscito.")
      }
    } catch {
      setError("Caricamento non riuscito.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
        aria-label="Allega file"
        title={error || "Allega file"}
      >
        {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,application/zip"
        className="hidden"
        onChange={handleFile}
      />
    </>
  )
}
