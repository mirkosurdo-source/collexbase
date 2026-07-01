import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { api } from "./api"
import { clearToken, getToken, setToken } from "./auth"

export interface SessionUser {
  id: string
  username: string
  name?: string
  email?: string
  avatarUrl?: string
  plan?: string
}

interface AuthState {
  user: SessionUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const token = await getToken()
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    const res = await api.get<{ user: SessionUser }>("/api/auth/me")
    setUser(res.ok && res.data ? res.data.user : null)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const signIn = useCallback(
    async (email: string, password: string) => {
      const res = await api.post<{ token: string; user: SessionUser }>(
        "/api/auth/login",
        { email, password },
        false,
      )
      if (!res.ok || !res.data?.token) {
        return { ok: false, error: res.error ?? "Credenziali non valide" }
      }
      await setToken(res.data.token)
      setUser(res.data.user)
      return { ok: true }
    },
    [],
  )

  const signOut = useCallback(async () => {
    await clearToken()
    setUser(null)
  }, [])

  const value = useMemo<AuthState>(
    () => ({ user, loading, signIn, signOut, refresh }),
    [user, loading, signIn, signOut, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
