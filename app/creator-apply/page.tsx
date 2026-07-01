import type { Metadata } from "next"
import CreatorApplyClient from "@/components/creator/CreatorApplyClient"

export const metadata: Metadata = {
  title: "Diventa Creator Partner | CollexBase",
  description:
    "Guadagna soldi reali, ottieni vantaggi esclusivi per i tuoi follower e accedi a strumenti professionali per far crescere la tua community su CollexBase.",
}

export default function CreatorApplyPage() {
  return <CreatorApplyClient />
}
