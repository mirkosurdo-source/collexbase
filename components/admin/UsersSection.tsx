"use client"

import { useState } from "react"
import {
  SectionHeader, Spinner, Toolbar, TextInput, Select, TableShell, Th, Td, EmptyRow, Pagination,
  StatusPill, PlanPill, ActionBtn, useAdminData, adminPost, fmtEUR, fmtNum, fmtDate,
} from "./shared"

interface Row {
  id: string
  name: string
  username: string
  email: string
  role: string
  blocked: boolean
  createdAt: string
  plan: string
  coins: number
  walletAvailable: number
}

interface Resp {
  success: boolean
  users: Row[]
  total: number
  page: number
  pages: number
}

export default function UsersSection() {
  const [q, setQ] = useState("")
  const [role, setRole] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState("")
  const [notice, setNotice] = useState("")

  const query = `/api/admin/users?q=${encodeURIComponent(q)}&role=${role}&status=${status}&page=${page}`
  const { data, loading, error, reload } = useAdminData<Resp>(query, [q, role, status, page])

  async function act(userId: string, action: string, extra: Record<string, unknown> = {}) {
    setBusy(userId + action)
    setNotice("")
    const res = await adminPost<{ success: boolean; message?: string; tempPassword?: string }>(
      "/api/admin/users/action",
      { userId, action, ...extra },
    )
    setBusy("")
    if (res.success) {
      if (res.tempPassword) setNotice(`Password temporanea: ${res.tempPassword}`)
      else if (res.message) setNotice(res.message)
      reload()
    } else {
      setNotice(res.message || "Azione non riuscita.")
    }
  }

  return (
    <div>
      <SectionHeader title="Utenti" description="Cerca, filtra e gestisci tutti gli account registrati." />

      <Toolbar>
        <TextInput value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Cerca nome, username o email…" />
        <Select value={role} onChange={(v) => { setRole(v); setPage(1) }} options={[
          { value: "", label: "Tutti i ruoli" },
          { value: "user", label: "Utenti" },
          { value: "admin", label: "Admin" },
        ]} />
        <Select value={status} onChange={(v) => { setStatus(v); setPage(1) }} options={[
          { value: "", label: "Tutti gli stati" },
          { value: "active", label: "Attivi" },
          { value: "blocked", label: "Bloccati" },
        ]} />
        {data && <span className="ml-auto text-sm text-muted-foreground">{fmtNum(data.total)} utenti</span>}
      </Toolbar>

      {notice && <p className="mb-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">{notice}</p>}

      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="text-sm text-muted-foreground">{error}</p>
      ) : (
        <>
          <TableShell head={<><Th>Utente</Th><Th>Piano</Th><Th className="text-right">Coin</Th><Th className="text-right">Wallet</Th><Th>Stato</Th><Th>Iscritto</Th><Th className="text-right">Azioni</Th></>}>
            {!data?.users.length ? (
              <EmptyRow colSpan={7} />
            ) : (
              data.users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30">
                  <Td>
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted-foreground">@{u.username} · {u.email}</div>
                    {u.role === "admin" && <span className="mt-0.5 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">ADMIN</span>}
                  </Td>
                  <Td><PlanPill plan={u.plan} /></Td>
                  <Td className="text-right">{fmtNum(u.coins)}</Td>
                  <Td className="text-right">{fmtEUR(u.walletAvailable)}</Td>
                  <Td><StatusPill status={u.blocked ? "blocked" : "active"} /></Td>
                  <Td className="text-xs text-muted-foreground">{fmtDate(u.createdAt)}</Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <ActionBtn variant={u.blocked ? "primary" : "danger"} disabled={!!busy} onClick={() => act(u.id, u.blocked ? "unblock" : "block")}>
                        {u.blocked ? "Sblocca" : "Blocca"}
                      </ActionBtn>
                      <ActionBtn disabled={!!busy} onClick={() => act(u.id, "set_role", { role: u.role === "admin" ? "user" : "admin" })}>
                        {u.role === "admin" ? "Rimuovi admin" : "Rendi admin"}
                      </ActionBtn>
                      <ActionBtn disabled={!!busy} onClick={() => act(u.id, "reset_password")}>Reset PW</ActionBtn>
                    </div>
                  </Td>
                </tr>
              ))
            )}
          </TableShell>
          <Pagination page={data?.page || 1} pages={data?.pages || 1} onPage={setPage} />
        </>
      )}
    </div>
  )
}
