"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ImagePlus, Loader2, X } from "lucide-react"
import { CATEGORIES } from "@/lib/collection-helpers"

const BLOG_TYPES = [
  { key: "guide", label: "Guida" },
  { key: "discussion", label: "Discussione" },
  { key: "help", label: "Aiuto" },
]

export default function NewPostPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [kind, setKind] = useState<"post" | "blog">("post")
  const [title, setTitle] = useState("")
  const [blogType, setBlogType] = useState("guide")
  const [body, setBody] = useState("")
  const [category, setCategory] = useState("")
  const [visibility, setVisibility] = useState<"public" | "followers">("public")
  const [tagsInput, setTagsInput] = useState("")
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const t = localStorage.getItem("token")
    if (!t) {
      router.replace("/login")
      return
    }
    setToken(t)
  }, [router])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || !token) return
    setUploading(true)
    setError("")
    try {
      for (const file of Array.from(files).slice(0, 6 - images.length)) {
        const fd = new FormData()
        fd.append("file", file)
        const res = await fetch("/api/community/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        })
        const data = await res.json()
        if (res.ok && data.url) {
          setImages((prev) => [...prev, data.url])
        } else {
          setError(data.message || "Caricamento immagine fallito.")
        }
      }
    } catch {
      setError("Caricamento immagine fallito.")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token || submitting) return

    if (kind === "blog" && !title.trim()) {
      setError("Il titolo è obbligatorio per i post del blog.")
      return
    }
    if (!body.trim() && images.length === 0) {
      setError("Aggiungi del testo o un'immagine.")
      return
    }

    setSubmitting(true)
    setError("")
    try {
      const tags = tagsInput
        .split(/[,\s]+/)
        .map((t) => t.trim().replace(/^#/, ""))
        .filter(Boolean)
      const res = await fetch("/api/community/post/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ kind, title, blogType, body, category, visibility, images, tags }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        router.push(`/community/${data.id}`)
      } else {
        setError(data.message || "Pubblicazione fallita.")
        setSubmitting(false)
      }
    } catch {
      setError("Errore di rete.")
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Crea contenuto</h1>

      <div className="mb-5 inline-flex rounded-lg border border-border p-1">
        {(["post", "blog"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              kind === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {k === "post" ? "Post rapido" : "Articolo / Guida"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {kind === "blog" ? (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Titolo</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titolo dell'articolo"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Tipo</label>
              <div className="flex gap-2">
                {BLOG_TYPES.map((b) => (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => setBlogType(b.key)}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                      blogType === b.key
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : null}

        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">
            {kind === "blog" ? "Contenuto" : "Cosa vuoi condividere?"}
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={kind === "blog" ? 10 : 5}
            placeholder={kind === "blog" ? "Scrivi il tuo articolo..." : "Scrivi qualcosa..."}
            className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary"
          />
        </div>

        {images.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {images.map((src, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src || "/placeholder.svg"} alt={`Immagine ${i + 1}`} className="h-24 w-full rounded-lg border border-border object-cover" />
                <button
                  type="button"
                  onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-foreground"
                  aria-label="Rimuovi immagine"
                >
                  <X width={14} height={14} />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || images.length >= 6}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-40"
          >
            {uploading ? <Loader2 width={16} height={16} className="animate-spin" /> : <ImagePlus width={16} height={16} />}
            Aggiungi immagini
          </button>
          <span className="text-xs text-muted-foreground">{images.length}/6</span>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleUpload} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Categoria</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary"
            >
              <option value="">Nessuna</option>
              {CATEGORIES.map((c: string) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Visibilità</label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as "public" | "followers")}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary"
            >
              <option value="public">Pubblico</option>
              <option value="followers">Solo follower</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">Tag</label>
          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="es. vintage, raro, anni80"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary"
          />
          <p className="mt-1 text-xs text-muted-foreground">Separa i tag con virgole o spazi.</p>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? <Loader2 width={16} height={16} className="animate-spin" /> : null}
            Pubblica
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-border px-5 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
          >
            Annulla
          </button>
        </div>
      </form>
    </div>
  )
}
