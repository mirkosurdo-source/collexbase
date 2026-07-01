import ReferralDashboard from "@/components/referral/ReferralDashboard"

export const metadata = {
  title: "Invita amici · CollexBase",
  description: "Invita i tuoi amici su CollexBase e guadagna CollexCoins per ogni iscrizione.",
}

export default function ReferralPage() {
  return (
    <main className="mx-auto max-w-5xl px-4">
      <ReferralDashboard />
    </main>
  )
}
