"use client"

import { useState } from "react"
import { Loader2, ImagePlus, X } from "lucide-react"
import { chatFetch, uploadAttachment } from "@/lib/chat-client"

const KINDS = [
  { key: "discussion", label: "Discussione" },
  { key: "showcase", label: "Vetrina" },
  { key: "sale", label: "Vendita" },
  { key: "trade", label: "Scambio" },
]

export default function GroupPostComposer({
  groupId,
  onCreated,
}: {
  groupId: string
  onCreated: () => void
}) {
  const [kind, setKind] = useState("discussion")
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [price, setPrice] = useState("")
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const needsPrice = kind === "sale"
  const isMarketplace = kind === "sale" || kind === "trade"

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const res = await uploadAttachment(file)
      if (res.success && res.attachment?.url) setImages((prev) => [...prev, res.attachment!.url])
    } catch {
      // ignore upload errors
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (body.trim().length === 0 && title.trim().length === 0) {
      setError("Scrivi qualcosa prima di pubblicare.")
      return
    }
    setSubmitting(true)
    setError("")
    try {
      const res = await chatFetch<{ success: boolean; message?: string }>(`/api/groups/${groupId}/posts`, {
        method: "POST",
        body: JSON.stringify({
          kind,
          title: title.trim(),
          body: body.trim(),
          images,
          price: needsPrice && price ? Number(price) : undefined,
        }),
      })
      if (res.success) {
        setTitle("")
        setBody("")
        setPrice("")
        setImages([])
        setKind("discussion")
        onCreated()
      } else {
        setError(res.message || "Impossibile pubblicare.")
      }
    } catch {
      setError("Errore di rete. Riprova.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            onClick={() => setKind(k.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              kind === k.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      {(isMarketplace || title) && (
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder={isMarketplace ? "Titolo dell'annuncio" : "Titolo (opzionale)"}
          className="mb-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
      )}

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={2000}
        rows={3}
        placeholder="Condividi un pensiero, una novità o un pezzo della tua collezione…"
        className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
      />

      {needsPrice ? (
        <input
          type="number"
          min={0}
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Prezzo (€)"
          className="mt-2 w-40 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
      ) : null}

      {images.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {images.map((url, i) => (
            <div key={url} className="relative h-16 w-16 overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url || "/placeholder.svg"} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                className="absolute right-0.5 top-0.5 rounded-full bg-background/80 p-0.5 text-foreground"
                aria-label="Rimuovi immagine"
              >
                <X width={12} height={12} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}

      <div className="mt-3 flex items-center justify-between">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent">
          {uploading ? <Loader2 className="animate-spin" width={14} height={14} /> : <ImagePlus width={14} height={14} />}
          Immagine
          <input type="file" accept="image/*" className="hidden" onChange={onPickImage} disabled={uploading} />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? <Loader2 className="animate-spin" width={16} height={16} /> : null}
          Pubblica
        </button>
      </div>
    </form>
  )
}
