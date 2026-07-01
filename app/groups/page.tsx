import type { Metadata } from "next"
import GroupsDiscoveryClient from "./GroupsDiscoveryClient"

export const metadata: Metadata = {
  title: "Gruppi | CollexBase",
  description: "Scopri e unisciti a gruppi tematici di collezionisti: discuti, scambia e condividi la tua passione.",
}

export default function GroupsPage() {
  return <GroupsDiscoveryClient />
}
