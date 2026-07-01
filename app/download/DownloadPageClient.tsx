"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { QRCodeSVG } from "qrcode.react"
import {
  Smartphone,
  Download,
  ScanLine,
  Sparkles,
  Store,
  Bell,
  Apple,
  ShieldCheck,
} from "lucide-react"
import { useTranslation } from "@/lib/i18n/LanguageProvider"
import CollexSpark from "@/components/collexspark/CollexSpark"

/**
 * Blocco 35 — Sezione Download.
 *
 * Public marketing page. The APK is produced by an Expo EAS build and hosted
 * at APK_URL; the QR encodes the public /download URL so phones land here.
 * Fully localized via the `download.*` dictionary keys.
 */

const APP_VERSION = "1.0.0"
const APK_URL = "/collexbase.apk"

const CHANGELOG: { version: string; date: string; items: string[] }[] = [
  {
    version: "1.0.0",
    date: "2026-06-30",
    items: [
      "Scanner intelligente singolo e multiplo",
      "Marketplace, aste e scambi mobile",
      "Advisor, vetrine e gruppi",
      "Notifiche push in tempo reale",
    ],
  },
]

export default function DownloadPageClient() {
  const { t } = useTranslation()
  const [origin, setOrigin] = useState("")

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const steps = [t("download.step1"), t("download.step2"), t("download.step3"), t("download.step4")]
  const features = [
    { icon: ScanLine, text: t("download.f1") },
    { icon: Sparkles, text: t("download.f2") },
    { icon: Store, text: t("download.f3") },
    { icon: Bell, text: t("download.f4") },
  ]

  return (
    <div className="py-8">
      {/* Hero */}
      <section className="mb-8 flex flex-col items-center gap-6 rounded-2xl border border-spark/20 bg-spark-muted/40 p-6 text-center sm:p-10">
        <CollexSpark pose="happy" size="lg" still />
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-spark">CollexBase Mobile</p>
          <h1 className="mt-2 text-balance text-3xl font-bold text-foreground sm:text-4xl">
            {t("download.title")}
          </h1>
          <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">{t("download.subtitle")}</p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Android download card */}
        <section className="flex flex-col rounded-2xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-foreground/5">
              <Smartphone className="h-6 w-6 text-foreground" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t("download.androidTitle")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("download.version")} {APP_VERSION}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <a
              href={APK_URL}
              download
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-spark px-5 py-3 font-semibold text-spark-foreground transition-opacity hover:opacity-90"
            >
              <Download className="h-5 w-5" aria-hidden="true" />
              {t("download.download")}
            </a>

            <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-background p-3">
              <div className="rounded-lg bg-white p-2">
                <QRCodeSVG value={origin ? `${origin}/download` : "https://collexbase.app/download"} size={96} />
              </div>
              <p className="text-center text-xs text-muted-foreground">{t("download.qr")}</p>
            </div>
          </div>

          {/* Install steps */}
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-semibold text-foreground">{t("download.install")}</h3>
            <ol className="flex flex-col gap-2">
              {steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-spark/15 text-xs font-semibold text-spark">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* iOS coming soon + features */}
        <div className="flex flex-col gap-6">
          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-4">
              <Image
                src="/app-icon.png"
                alt="CollexBase app"
                width={64}
                height={64}
                className="rounded-2xl border border-border"
              />
              <div className="flex-1">
                <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-foreground/5 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  <Apple className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("download.iosBanner")}
                </div>
                <h2 className="text-lg font-semibold text-foreground">{t("download.iosTitle")}</h2>
              </div>
            </div>
            <p className="mt-4 text-pretty text-sm leading-relaxed text-muted-foreground">
              {t("download.iosText")}
            </p>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold text-foreground">{t("download.features")}</h2>
            <ul className="flex flex-col gap-3">
              {features.map(({ icon: Icon, text }, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-foreground">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-spark/10">
                    <Icon className="h-5 w-5 text-spark" aria-hidden="true" />
                  </span>
                  <span className="leading-relaxed">{text}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {/* Changelog */}
      <section className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">{t("download.changelog")}</h2>
        <div className="flex flex-col gap-5">
          {CHANGELOG.map((entry) => (
            <div key={entry.version} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-spark/10 px-2 py-0.5 text-xs font-semibold text-spark">
                  v{entry.version}
                </span>
                <span className="text-xs text-muted-foreground">{entry.date}</span>
              </div>
              <ul className="flex flex-col gap-1.5 pl-1">
                {entry.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-spark/70" aria-hidden="true" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
