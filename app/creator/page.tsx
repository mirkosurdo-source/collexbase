import CreatorDashboard from "@/components/creator/CreatorDashboard"

export const metadata = {
  title: "Creator Partner · CollexBase",
  description: "Dashboard del programma Creator Partner: commissioni, CreatorCredits e utenti invitati.",
}

export default function CreatorPage() {
  return (
    <main className="mx-auto max-w-5xl px-4">
      <CreatorDashboard />
    </main>
  )
}
