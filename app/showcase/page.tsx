import type { Metadata } from "next"
import ShowcaseDiscoveryClient from "./ShowcaseDiscoveryClient"

export const metadata: Metadata = {
  title: "Vetrine | CollexBase",
  description: "Esplora le vetrine pubbliche dei collezionisti: pezzi rari, temi e collezioni in evidenza.",
}

export default function ShowcasePage() {
  return <ShowcaseDiscoveryClient />
}
