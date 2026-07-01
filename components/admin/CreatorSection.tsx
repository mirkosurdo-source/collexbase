"use client"

import { useCallback, useEffect, useState } from "react"
import {
  SectionHeader,
  StatCard,
  Card,
  Toolbar,
  TextInput,
  TableShell,
  Th,
  Td,
  EmptyRow,
  ActionBtn,
  Spinner,
  fmtNum,
} from "./shared"

interface CreatorRow {
  creatorId: string
  username: string
  email: string
  referralCode: string
  commissionRate: number
  commissionDurationMonths: number
  balance: number
  totalEarned: number
  pendingPayout: number
  totalPaidOut: number
  totalUsersInvited: number
  active: boolean
}

interface AdminStats {
  totalCreators: number
  activeCreators: number
  totalEarned: number
  totalBalance: number
  totalPaidOut: number
  pendingPayout: number
  pendingPayoutRequests: number
  totalCommissionEvents: number
}

interface PayoutRow {
  id: string
  creatorId: string
  amount: number
  destination: string
  status: string
  note: string
  at: string
}

/** Formats a number as euros. */
function eur(n: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n || 0)
}

export default function CreatorSection() {
  const [creators, setCreators] = useState<CreatorRow[]>([])
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [payouts, setPayouts] = useState<PayoutRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [newId, setNewId] = useState("")
  const [msg, setMsg] = useState<string | null>(null)

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null

  const authHeaders = useCallback(
    (json = false): HeadersInit => ({
      ...(json ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [listRes, statsRes, payoutsRes] = await Promise.all([
        fetch("/api/admin/creator/list", { headers: authHeaders() }),
        fetch("/api/admin/creator/stats", { headers: authHeaders() }),
        fetch("/api/admin/creator/payouts?status=pending", { headers: authHeaders() }),
      ])
      const listJson = await listRes.json().catch(() => null)
      if (listJson?.ok) setCreators(listJson.creators)
      const statsJson = await statsRes.json().catch(() => null)
      if (statsJson?.ok) setStats(statsJson.stats)
      const payoutsJson = await payoutsRes.json().catch(() => null)
      if (payoutsJson?.ok) setPayouts(payoutsJson.requests)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  useEffect(() => {
    load()
  }, [load])

  const activate = useCallback(
    async (creatorId: string) => {
      setBusyId(creatorId)
      setMsg(null)
      try {
        const res = await fetch("/api/admin/creator/activate", {
          method: "POST",
          headers: authHeaders(true),
          body: JSON.stringify({ creatorId }),
        })
        const json = await res.json()
        if (!res.ok || !json.ok) throw new Error(json.error || "Errore.")
        setMsg("Creator attivato.")
        setNewId("")
        await load()
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Errore.")
      } finally {
        setBusyId(null)
      }
    },
    [authHeaders, load],
  )

  const deactivate = useCallback(
    async (creatorId: string) => {
      setBusyId(creatorId)
      setMsg(null)
      try {
        const res = await fetch("/api/admin/creator/deactivate", {
          method: "POST",
          headers: authHeaders(true),
          body: JSON.stringify({ creatorId }),
        })
        const json = await res.json()
        if (!res.ok || !json.ok) throw new Error(json.error || "Errore.")
        setMsg("Creator sospeso.")
        await load()
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Errore.")
      } finally {
        setBusyId(null)
      }
    },
    [authHeaders, load],
  )

  const decidePayout = useCallback(
    async (requestId: string, approve: boolean) => {
      setBusyId(requestId)
      setMsg(null)
      try {
        const res = await fetch("/api/admin/creator/payouts", {
          method: "POST",
          headers: authHeaders(true),
          body: JSON.stringify({ requestId, approve }),
        })
        const json = await res.json()
        if (!res.ok || !json.ok) throw new Error(json.error || "Errore.")
        setMsg(approve ? "Payout approvato." : "Payout rifiutato.")
        await load()
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Errore.")
      } finally {
        setBusyId(null)
      }
    },
    [authHeaders, load],
  )

  if (loading) return <Spinner />

  return (
    <div>
      <SectionHeader
        title="Creator Partner"
        description="Gestisci i creator, le commissioni reali in euro, i payout e gli utenti invitati."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Creator totali" value={fmtNum(stats?.totalCreators ?? creators.length)} />
        <StatCard label="Attivi" value={fmtNum(stats?.activeCreators ?? 0)} />
        <StatCard label="Commissioni generate" value={eur(stats?.totalEarned ?? 0)} />
        <StatCard label="Pagato" value={eur(stats?.totalPaidOut ?? 0)} />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Saldo creator" value={eur(stats?.totalBalance ?? 0)} />
        <StatCard label="In attesa payout" value={eur(stats?.pendingPayout ?? 0)} />
        <StatCard label="Richieste pendenti" value={fmtNum(stats?.pendingPayoutRequests ?? payouts.length)} />
        <StatCard label="Commissioni totali" value={fmtNum(stats?.totalCommissionEvents ?? 0)} />
      </div>

      <Card className="mb-5">
        <h3 className="mb-2 text-sm font-medium text-foreground">Attiva un nuovo creator</h3>
        <Toolbar>
          <TextInput value={newId} onChange={setNewId} placeholder="ID utente (ObjectId)" />
          <ActionBtn
            variant="primary"
            disabled={!newId.trim() || busyId === newId.trim()}
            onClick={() => activate(newId.trim())}
          >
            Attiva creator
          </ActionBtn>
        </Toolbar>
        {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
      </Card>

      {payouts.length > 0 && (
        <Card className="mb-5">
          <h3 className="mb-3 text-sm font-medium text-foreground">Richieste payout in attesa</h3>
          <TableShell
            head={
              <>
                <Th>Creator</Th>
                <Th>Importo</Th>
                <Th>Destinazione</Th>
                <Th>Data</Th>
                <Th className="text-right">Azioni</Th>
              </>
            }
          >
            {payouts.map((p) => (
              <tr key={p.id}>
                <Td className="font-mono text-xs">{p.creatorId}</Td>
                <Td className="font-medium">{eur(p.amount)}</Td>
                <Td className="text-xs text-muted-foreground">{p.destination || "—"}</Td>
                <Td className="text-xs text-muted-foreground">{new Date(p.at).toLocaleDateString("it-IT")}</Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-2">
                    <ActionBtn variant="primary" disabled={busyId === p.id} onClick={() => decidePayout(p.id, true)}>
                      Approva
                    </ActionBtn>
                    <ActionBtn variant="danger" disabled={busyId === p.id} onClick={() => decidePayout(p.id, false)}>
                      Rifiuta
                    </ActionBtn>
                  </div>
                </Td>
              </tr>
            ))}
          </TableShell>
        </Card>
      )}

      <TableShell
        head={
          <>
            <Th>Creator</Th>
            <Th>Codice</Th>
            <Th>Commissione</Th>
            <Th>Saldo / Guadagnato</Th>
            <Th>Pagato</Th>
            <Th>Invitati</Th>
            <Th>Stato</Th>
            <Th className="text-right">Azioni</Th>
          </>
        }
      >
        {creators.length === 0 ? (
          <EmptyRow colSpan={8} text="Nessun creator attivo." />
        ) : (
          creators.map((c) => (
            <tr key={c.creatorId}>
              <Td>
                <div className="font-medium">{c.username}</div>
                <div className="text-xs text-muted-foreground">{c.email}</div>
              </Td>
              <Td className="font-mono text-xs">{c.referralCode}</Td>
              <Td>
                {Math.round(c.commissionRate * 100)}% · {c.commissionDurationMonths}m
              </Td>
              <Td>
                {eur(c.balance)}
                <span className="text-xs text-muted-foreground"> / {eur(c.totalEarned)}</span>
              </Td>
              <Td>{eur(c.totalPaidOut)}</Td>
              <Td>{fmtNum(c.totalUsersInvited)}</Td>
              <Td>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    c.active
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {c.active ? "Attivo" : "Sospeso"}
                </span>
              </Td>
              <Td className="text-right">
                {c.active ? (
                  <ActionBtn variant="danger" disabled={busyId === c.creatorId} onClick={() => deactivate(c.creatorId)}>
                    Sospendi
                  </ActionBtn>
                ) : (
                  <ActionBtn variant="primary" disabled={busyId === c.creatorId} onClick={() => activate(c.creatorId)}>
                    Riattiva
                  </ActionBtn>
                )}
              </Td>
            </tr>
          ))
        )}
      </TableShell>
    </div>
  )
}
