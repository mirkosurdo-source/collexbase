import type { Metadata } from "next"
import DownloadPageClient from "./DownloadPageClient"

export const metadata: Metadata = {
  title: "Scarica l'app · CollexBase",
  description:
    "Scarica CollexBase per Android: scanner intelligente, marketplace, aste, scambi e advisor sul tuo telefono. Presto anche su iOS.",
}

export default function DownloadPage() {
  return <DownloadPageClient />
}
