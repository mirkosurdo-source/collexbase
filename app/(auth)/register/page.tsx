"use client"

import { useState } from "react"
import Link from "next/link"

const initialForm = {
  name: "",
  username: "",
  email: "",
  password: "",
  birthdate: "",
  address: "",
  bio: "",
  avatar: "",
}

export default function RegisterPage() {
  const [form, setForm] = useState(initialForm)
  const [status, setStatus] = useState<{ type: "idle" | "loading" | "error" | "success"; message: string }>({
    type: "idle",
    message: "",
  })

  function update(field: keyof typeof initialForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus({ type: "loading", message: "" })

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.success) {
        setStatus({ type: "success", message: data.message })
        setForm(initialForm)
      } else {
        setStatus({ type: "error", message: data.message })
      }
    } catch {
      setStatus({ type: "error", message: "Errore di connessione." })
    }
  }

  const inputClass =
    "rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-900 dark:border-neutral-700 dark:text-neutral-100 dark:focus:border-neutral-100"
  const labelClass = "text-sm font-medium text-neutral-700 dark:text-neutral-300"

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center py-12">
      <div className="w-full max-w-lg rounded-xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Crea il tuo account
        </h1>
        <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
          Unisciti alla community di collezionisti di CollexBase.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className={labelClass}>Nome completo</label>
              <input id="name" type="text" required value={form.name} onChange={(e) => update("name", e.target.value)} className={inputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="username" className={labelClass}>Username pubblico</label>
              <input id="username" type="text" required value={form.username} onChange={(e) => update("username", e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className={labelClass}>Email</label>
              <input id="email" type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} className={inputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className={labelClass}>Password</label>
              <input id="password" type="password" required value={form.password} onChange={(e) => update("password", e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="birthdate" className={labelClass}>Data di nascita</label>
              <input id="birthdate" type="date" value={form.birthdate} onChange={(e) => update("birthdate", e.target.value)} className={inputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="address" className={labelClass}>Indirizzo</label>
              <input id="address" type="text" value={form.address} onChange={(e) => update("address", e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="avatar" className={labelClass}>Foto profilo (URL)</label>
            <input id="avatar" type="url" placeholder="https://..." value={form.avatar} onChange={(e) => update("avatar", e.target.value)} className={inputClass} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="bio" className={labelClass}>Biografia</label>
            <textarea id="bio" rows={3} value={form.bio} onChange={(e) => update("bio", e.target.value)} className={inputClass} />
          </div>

          {status.type === "error" && (
            <p className="text-sm text-red-600 dark:text-red-400">{status.message}</p>
          )}
          {status.type === "success" && (
            <p className="text-sm text-green-600 dark:text-green-400">{status.message}</p>
          )}

          <button
            type="submit"
            disabled={status.type === "loading"}
            className="mt-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
          >
            {status.type === "loading" ? "Registrazione in corso..." : "Registrati"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
          Hai già un account?{" "}
          <Link href="/login" className="font-medium text-neutral-900 underline dark:text-neutral-100">
            Accedi
          </Link>
        </p>
      </div>
    </div>
  )
}
