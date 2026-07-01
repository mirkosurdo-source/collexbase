import type { Metadata } from "next"
import ShowcaseDetailClient from "./ShowcaseDetailClient"

export const metadata: Metadata = {
  title: "Vetrina | CollexBase",
  description: "La vetrina pubblica di un collezionista: pezzi in evidenza, rarità e valore.",
}

export default async function ShowcasePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  return <ShowcaseDetailClient username={username} />
}
