"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { fmtEUR, sellerDelete, sellerPatch, sellerPost, type SellerProfileDTO } from "@/components/seller/shared"

interface InventoryItem {
  id: string
  cardId: string
  title: string
  description: string
  category: string
  condition: string
  price: number
  quantity: number
  images: string[]
  published: boolean
  listingId: string | null
  updatedAt: string
}

const CONDITIONS = ["Mint", "Near Mint", "Excellent", "Good", "Light Played", "Played", "Poor"]
const EMPTY_FORM = { title: "", description: "", category: "", condition: "Near Mint", price: "", quantity: "1", images: [] as string[] }

export default function SellerInventoryClient() {
  const router = useRouter()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/seller/inventory", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
      })
      if (res.status === 401) return router.push("/login")
      if (res.status === 403) return router.push("/seller")
      const json = (await res.json()) as { success: boolean; items: InventoryItem[]; message?: string }
      if (!json.success) setError(json.message || "Errore di caricamento.")
      else setItems(json.items)
    } catch {
      setError("Errore di connessione.")
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  function openCreate() {
    setEditId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(item: InventoryItem) {
    setEditId(item.id)
    setForm({
      title: item.title,
      description: item.description,
      category: item.category,
      condition: item.condition || "Near Mint",
      price: String(item.price),
      quantity: String(item.quantity),
      images: item.images || [],
    })
    setShowForm(true)
  }

  async function uploadImage(file: File) {
    setUploading(true)
    setError("")
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/seller/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
        body: fd,
      })
      const json = (await res.json()) as { success: boolean; url?: string; message?: string }
      if (json.success && json.url) setForm((f) => ({ ...f, images: [...f.images, json.url as string] }))
      else setError(json.message || "Caricamento immagine non riuscito.")
    } catch {
      setError("Errore durante il caricamento.")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  async function save() {
    const price = Number(form.price)
    if (!form.title.trim() || !Number.isFinite(price) || price <= 0) {
      setError("Inserisci un titolo e un prezzo validi.")
      return
    }
    setBusy("save")
    setError("")
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        condition: form.condition,
        price,
        quantity: Number(form.quantity) || 1,
        images: form.images,
      }
      const res = editId
        ? await sellerPatch<{ success: boolean; message?: string }>(`/api/seller/inventory/${editId}`, payload)
        : await sellerPost<{ success: boolean; message?: string }>("/api/seller/inventory", payload)
      if (!res.success) setError(res.message || "Errore di salvataggio.")
      else {
        setShowForm(false)
        await load()
      }
    } finally {
      setBusy(null)
    }
  }

  async function togglePublish(item: InventoryItem) {
    setBusy(item.id)
    try {
      const res = await sellerPatch<{ success: boolean; message?: string }>(`/api/seller/inventory/${item.id}`, {
        published: !item.published,
      })
      if (!res.success) setError(res.message || "Errore.")
      else await load()
    } finally {
      setBusy(null)
    }
  }

  async function remove(item: InventoryItem) {
    if (!window.confirm(`Eliminare "${item.title}" dall'inventario?`)) return
    setBusy(item.id)
    try {
      const res = await sellerDelete<{ success: boolean; message?: string }>(`/api/seller/inventory/${item.id}`)
      if (!res.success) setError(res.message || "Errore.")
      else await load()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Inventario</h1>
          <p className="mt-1 text-sm text-muted-foreground">Crea, pubblica e gestisci gli articoli in vendita.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Nuovo articolo
        </button>
      </header>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-foreground" />
          Caricamento inventario…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Nessun articolo. Crea il tuo primo articolo per iniziare a vendere.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
              <div className="relative aspect-square bg-muted">
                {item.images[0] ? (
                  <Image src={item.images[0] || "/placeholder.svg"} alt={item.title} fill className="object-cover" sizes="(max-width: 640px) 100vw, 33vw" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Nessuna immagine</div>
                )}
                <span
                  className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                    item.published
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {item.published ? "Pubblicato" : "Bozza"}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-3">
                <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {item.condition} · Qtà {item.quantity}
                </p>
                <p className="mt-1 text-base font-semibold text-foreground">{fmtEUR(item.price)}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={busy === item.id}
                    onClick={() => togglePublish(item)}
                    className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
                  >
                    {item.published ? "Rimuovi" : "Pubblica"}
                  </button>
                  <button
                    type="button"
                    disabled={busy === item.id}
                    onClick={() => openEdit(item)}
                    className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
                  >
                    Modifica
                  </button>
                  <button
                    type="button"
                    disabled={busy === item.id}
                    onClick={() => remove(item)}
                    className="rounded-md bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-500/20 disabled:opacity-50 dark:text-red-400"
                  >
                    Elimina
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowForm(false)}>
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-foreground">{editId ? "Modifica articolo" : "Nuovo articolo"}</h2>
            <div className="mt-4 space-y-3">
              <Field label="Titolo">
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
                />
              </Field>
              <Field label="Descrizione">
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Categoria">
                  <input
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
                  />
                </Field>
                <Field label="Condizione">
                  <select
                    value={form.condition}
                    onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
                  >
                    {CONDITIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Prezzo (EUR)">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
                  />
                </Field>
                <Field label="Quantità">
                  <input
                    type="number"
                    min={1}
                    value={form.quantity}
                    onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
                  />
                </Field>
              </div>
              <Field label="Immagini">
                <div className="flex flex-wrap gap-2">
                  {form.images.map((url, idx) => (
                    <div key={idx} className="relative h-16 w-16 overflow-hidden rounded-lg border border-border">
                      <Image src={url || "/placeholder.svg"} alt={`Immagine ${idx + 1}`} fill className="object-cover" sizes="64px" />
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== idx) }))}
                        className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center bg-black/60 text-xs text-white"
                        aria-label="Rimuovi immagine"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:bg-accent disabled:opacity-50"
                  >
                    {uploading ? "…" : "+"}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) uploadImage(file)
                    }}
                  />
                </div>
              </Field>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={save}
                disabled={busy === "save"}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {busy === "save" ? "Salvataggio…" : "Salva"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
