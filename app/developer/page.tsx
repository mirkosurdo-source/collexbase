import type { Metadata } from "next"
import DeveloperPortal from "@/components/developer/DeveloperPortal"

export const metadata: Metadata = {
  title: "Developer Portal — CollexBase",
  description:
    "Gestisci le tue API key, configura webhook e consulta la documentazione delle API pubbliche CollexBase.",
}

export default function DeveloperPage() {
  return <DeveloperPortal />
}
