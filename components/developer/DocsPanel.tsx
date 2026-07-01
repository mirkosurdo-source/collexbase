"use client"

const ENDPOINTS: { method: string; path: string; scope: string; desc: string }[] = [
  { method: "GET", path: "/api/public/collection", scope: "read:collection", desc: "La tua collezione (paginata)." },
  { method: "GET", path: "/api/public/collection/{id}", scope: "read:collection", desc: "Dettaglio singolo oggetto." },
  { method: "GET", path: "/api/public/market/list", scope: "read:market", desc: "Annunci attivi nel marketplace." },
  { method: "GET", path: "/api/public/market/{id}", scope: "read:market", desc: "Dettaglio annuncio." },
  { method: "GET", path: "/api/public/auction/list", scope: "read:auction", desc: "Aste attive." },
  { method: "GET", path: "/api/public/auction/{id}", scope: "read:auction", desc: "Dettaglio asta." },
  { method: "GET", path: "/api/public/trade/list", scope: "read:trade", desc: "I tuoi scambi." },
  { method: "GET", path: "/api/public/trade/{id}", scope: "read:trade", desc: "Dettaglio scambio." },
  { method: "GET", path: "/api/public/showcase/list", scope: "read:showcase", desc: "Vetrine pubbliche." },
  { method: "GET", path: "/api/public/showcase/{id}", scope: "read:showcase", desc: "Dettaglio vetrina." },
  { method: "GET", path: "/api/public/groups/list", scope: "read:groups", desc: "Gruppi pubblici." },
  { method: "GET", path: "/api/public/groups/{id}", scope: "read:groups", desc: "Dettaglio gruppo." },
  { method: "GET", path: "/api/public/analytics/market", scope: "read:analytics", desc: "Panoramica di mercato." },
  { method: "GET", path: "/api/public/analytics/categories", scope: "read:analytics", desc: "Valore per categoria." },
  { method: "GET", path: "/api/public/analytics/trending", scope: "read:analytics", desc: "Oggetti di tendenza." },
  { method: "POST", path: "/api/public/advisor/analyze", scope: "read:advisor", desc: "Analisi AI di un'immagine." },
]

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-neutral-900 p-4 text-sm leading-relaxed text-neutral-100 dark:bg-black">
      <code className="font-mono">{children}</code>
    </pre>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{title}</h2>
      <div className="mt-3 space-y-3 text-sm text-neutral-600 dark:text-neutral-400">{children}</div>
    </div>
  )
}

export default function DocsPanel() {
  return (
    <div className="space-y-6">
      <Card title="Autenticazione">
        <p>
          Tutte le richieste richiedono una API key passata nell&apos;header{" "}
          <code className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-xs dark:bg-neutral-900">Authorization</code>.
          Le chiavi iniziano con <code className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-xs dark:bg-neutral-900">cxb_live_</code>.
        </p>
        <Code>{`curl https://collexbase.app/api/public/collection \\
  -H "Authorization: Bearer cxb_live_xxxxxxxxxxxx"`}</Code>
      </Card>

      <Card title="Rate limiting">
        <p>
          Ogni chiave ha un limite di richieste al minuto (default 60). Ogni risposta include gli header{" "}
          <code className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-xs dark:bg-neutral-900">X-RateLimit-Limit</code>,{" "}
          <code className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-xs dark:bg-neutral-900">X-RateLimit-Remaining</code> e{" "}
          <code className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-xs dark:bg-neutral-900">X-RateLimit-Reset</code>.
          Al superamento riceverai un <code className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-xs dark:bg-neutral-900">429</code>.
        </p>
      </Card>

      <Card title="Formato risposta">
        <p>Le risposte hanno sempre questa forma:</p>
        <Code>{`{
  "ok": true,
  "data": { /* payload */ }
}`}</Code>
        <p>In caso di errore:</p>
        <Code>{`{
  "ok": false,
  "error": "Messaggio descrittivo"
}`}</Code>
      </Card>

      <Card title="Endpoint disponibili">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-xs uppercase text-neutral-500 dark:border-neutral-800">
                <th className="py-2 pr-3">Metodo</th>
                <th className="py-2 pr-3">Endpoint</th>
                <th className="py-2 pr-3">Scope</th>
                <th className="py-2">Descrizione</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">
              {ENDPOINTS.map((e) => (
                <tr key={e.method + e.path}>
                  <td className="py-2 pr-3">
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-xs font-semibold ${
                        e.method === "GET"
                          ? "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
                      }`}
                    >
                      {e.method}
                    </span>
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs text-neutral-800 dark:text-neutral-200">{e.path}</td>
                  <td className="py-2 pr-3 font-mono text-xs text-neutral-500">{e.scope}</td>
                  <td className="py-2 text-neutral-600 dark:text-neutral-400">{e.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Verifica firma webhook">
        <p>
          Ogni consegna webhook include l&apos;header{" "}
          <code className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-xs dark:bg-neutral-900">X-CollexBase-Signature</code>,
          un HMAC SHA-256 del corpo grezzo firmato con il signing secret del webhook. Verificalo così:
        </p>
        <Code>{`import crypto from "crypto"

function verify(rawBody, signature, secret) {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex")
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected),
  )
}`}</Code>
      </Card>
    </div>
  )
}
