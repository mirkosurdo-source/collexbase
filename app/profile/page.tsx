"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import EditProfileClient, { type ProfileUser } from "./EditProfileClient"
import CollexCoinIndicator from "@/components/CollexCoinIndicator"

function formatDate(value?: string): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })
}

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<ProfileUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null

    if (!token) {
      router.replace("/login")
      return
    }

    async function loadProfile() {
      try {
        const res = await fetch("/api/auth/me", {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()

        if (data.success) {
          setUser(data.user)
        } else {
          localStorage.removeItem("token")
          document.cookie = "token=; path=/; max-age=0"
          router.replace("/login")
        }
      } catch {
        setError("Impossibile caricare il profilo.")
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [router])

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Caricamento...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="py-12">
      <div className="mx-auto w-full max-w-2xl rounded-xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Profilo</h1>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-neutral-50 transition-colors hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
            >
              Modifica profilo
            </button>
          )}
        </div>

        <div className="mt-8 flex items-center gap-4">
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatar || "/placeholder.svg"}
              alt={`Avatar di ${user.name}`}
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-200 text-xl font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <div>
              <p className="text-lg font-medium text-neutral-900 dark:text-neutral-50">{user.name}</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">@{user.username}</p>
            </div>
            <CollexCoinIndicator />
          </div>
        </div>

        <div className="mt-8 border-t border-neutral-200 pt-6 dark:border-neutral-800">
          {editing ? (
            <EditProfileClient
              user={user}
              onCancel={() => setEditing(false)}
              onSaved={(updated) => {
                setUser(updated)
                setEditing(false)
              }}
            />
          ) : (
            <dl className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">Nome</dt>
                <dd className="text-sm text-neutral-900 dark:text-neutral-100">{user.name}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">Username</dt>
                <dd className="text-sm text-neutral-900 dark:text-neutral-100">@{user.username}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">Email</dt>
                <dd className="text-sm text-neutral-900 dark:text-neutral-100">{user.email}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">Bio</dt>
                <dd className="text-sm text-neutral-900 dark:text-neutral-100">{user.bio || "—"}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">Data di nascita</dt>
                <dd className="text-sm text-neutral-900 dark:text-neutral-100">{formatDate(user.birthdate)}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">Indirizzo</dt>
                <dd className="text-sm text-neutral-900 dark:text-neutral-100">{user.address || "—"}</dd>
              </div>
            </dl>
          )}
        </div>
      </div>
    </div>
  )
}
