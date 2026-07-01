"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition-colors focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
const labelClass = "text-sm font-medium text-neutral-700 dark:text-neutral-300"

export default function NewAuctionPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    itemName: "",
    description: "",
    image: "",
    startingPrice: "",
    minIncrement: "",
    durationHours: "",
  })
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (form.itemName.trim().length < 1) {
      setError("Il nome dell'oggetto è obbligatorio.")
      return
    }
    if (!form.startingPrice || Number.isNaN(Number(form.startingPrice)) || Number(form.startingPrice) < 0) {
      setError("Inserisci un prezzo iniziale valido.")
      return
    }
    if (!form.minIncrement || Number.isNaN(Number(form.minIncrement)) || Number(form.minIncrement) <= 0) {
      setError("Inserisci un incremento minimo valido.")
      return
    }
    if (!form.durationHours || Number.isNaN(Number(form.durationHours)) || Number(form.durationHours) <= 0) {
      setError("Inserisci una durata valida (in ore).")
      return
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    if (!token) {
      router.replace("/login")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/auctions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          itemName: form.itemName,
          description: form.description,
          image: form.image,
          startingPrice: Number(form.startingPrice),
          minIncrement: Number(form.minIncrement),
          durationHours: Number(form.durationHours),
        }),
      })
      const data = await res.json()

      if (data.success) {
        router.push("/auctions")
      } else {
        setError(data.message || "Impossibile creare l'asta.")
      }
    } catch {
      setError("Impossibile creare l'asta.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="py-12">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/auctions" className="text-sm text-neutral-500 hover:underline dark:text-neutral-400">
          ← Torna alle aste
        </Link>

        <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Nuova asta</h1>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="itemName" className={labelClass}>
                Oggetto *
              </label>
              <input
                id="itemName"
                className={inputClass}
                value={form.itemName}
                onChange={(e) => update("itemName", e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="description" className={labelClass}>
                Descrizione
              </label>
              <textarea
                id="description"
                rows={3}
                className={inputClass}
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="image" className={labelClass}>
                URL immagine
              </label>
              <input
                id="image"
                className={inputClass}
                value={form.image}
                onChange={(e) => update("image", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="startingPrice" className={labelClass}>
                  Prezzo iniziale (€) *
                </label>
                <input
                  id="startingPrice"
                  inputMode="numeric"
                  className={inputClass}
                  value={form.startingPrice}
                  onChange={(e) => update("startingPrice", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="minIncrement" className={labelClass}>
                  Incremento min. (€) *
                </label>
                <input
                  id="minIncrement"
                  inputMode="numeric"
                  className={inputClass}
                  value={form.minIncrement}
                  onChange={(e) => update("minIncrement", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="durationHours" className={labelClass}>
                  Durata (ore) *
                </label>
                <input
                  id="durationHours"
                  inputMode="numeric"
                  className={inputClass}
                  value={form.durationHours}
                  onChange={(e) => update("durationHours", e.target.value)}
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="mt-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-50 transition-colors hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
              >
                {submitting ? "Creazione..." : "Crea asta"}
              </button>
              <Link
                href="/auctions"
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
              >
                Annulla
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
