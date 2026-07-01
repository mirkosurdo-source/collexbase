"use client"

import { useState } from "react"
import {
  SectionHeader, Spinner, Card, StatCard, Toolbar, TextInput, TableShell, Th, Td, EmptyRow, Pagination,
  ActionBtn, useAdminData, adminPost, fmtNum, fmtDate,
} from "./shared"

interface Balance { userId: string; username: string; email: string; balance: number }
interface Ledger { id: string; username: string; amount: number; type: string; description: string; balanceAfter: number; createdAt: string }
interface Resp {
  success: boolean
  circulating: number
  balances: Balance[]
  ledger: Ledger[]
  total: number
  page: number
  pages: number
}

export default function CoinsSection() {
  const [page, setPage] = useState(1)
  const { data, loading, error, reload } = useAdminData<Resp>(`/api/admin/coins?page=${page}`, [page])

  const [username, setUsername] = useState("")
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState("")

  async function adjust() {
    const amt = Number(amount)
    if (!username.trim() || !Number.isFinite(amt) || amt === 0) {
      setNotice("Inserisci username e un importo diverso da zero.")
      return
    }
    setBusy(true)
    setNotice("")
    const res = await adminPost<{ success: boolean; message?: string; balance?: number }>("/api/admin/coins/action", {
      username: username.trim(), amount: amt, description: reason.trim() || undefined,
    })
    setBusy(false)
    setNotice(res.message || (res.success ? "Saldo aggiornato." : "Azione non riuscita."))
    if (res.success) { setAmount(""); setReason(""); reload() }
  }

  return (
    <div>
      <SectionHeader title="Collex Coin" description="Saldi, movimenti globali e rettifiche manuali della valuta interna." />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Coin in circolazione" value={fmtNum(data?.circulating || 0)} />
        <StatCard label="Wallet con saldo" value={fmtNum(data?.total || 0)} />
      </div>

      <Card className="mb-6">
        <h3 className="mb-3 text-sm font-medium text-foreground">Rettifica manuale</h3>
        <div className="flex flex-wrap items-center gap-2">
          <TextInput value={username} onChange={setUsername} placeholder="username" />
          <TextInput value={amount} onChange={setAmount} placeholder="± importo (es. 100 o -50)" />
          <TextInput value={reason} onChange={setReason} placeholder="motivo (opzionale)" />
          <ActionBtn variant="primary" disabled={busy} onClick={adjust}>Applica</ActionBtn>
        </div>
        {notice && <p className="mt-3 text-sm text-muted-foreground">{notice}</p>}
      </Card>

      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="text-sm text-muted-foreground">{error}</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-medium text-foreground">Maggiori detentori</h3>
            <TableShell head={<><Th>Utente</Th><Th className="text-right">Saldo</Th></>}>
              {!data?.balances.length ? <EmptyRow colSpan={2} /> : data.balances.map((b) => (
                <tr key={b.userId} className="hover:bg-muted/30">
                  <Td><div className="font-medium">@{b.username}</div><div className="text-xs text-muted-foreground">{b.email}</div></Td>
                  <Td className="text-right font-medium">{fmtNum(b.balance)}</Td>
                </tr>
              ))}
            </TableShell>
            <Pagination page={data?.page || 1} pages={data?.pages || 1} onPage={setPage} />
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-foreground">Movimenti recenti</h3>
            <TableShell head={<><Th>Utente</Th><Th>Tipo</Th><Th className="text-right">Importo</Th><Th>Data</Th></>}>
              {!data?.ledger.length ? <EmptyRow colSpan={4} /> : data.ledger.map((l) => (
                <tr key={l.id} className="hover:bg-muted/30">
                  <Td className="text-xs">@{l.username}</Td>
                  <Td className="text-xs text-muted-foreground">{l.type}</Td>
                  <Td className={`text-right font-medium ${l.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {l.amount >= 0 ? "+" : ""}{fmtNum(l.amount)}
                  </Td>
                  <Td className="text-xs text-muted-foreground">{fmtDate(l.createdAt)}</Td>
                </tr>
              ))}
            </TableShell>
          </div>
        </div>
      )}
    </div>
  )
}
