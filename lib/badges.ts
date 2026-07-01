/**
 * Blocco 27 — Badge, livelli e achievement.
 *
 * Pure, DB-free logic. Badges and levels are computed from a `ProfileStats`
 * snapshot (gathered in lib/profile-stats.ts) so this module can be unit-tested
 * and reused on both server and client without a database connection.
 *
 * Fully additive: no existing reputation logic is modified.
 */

export type BadgeGroup =
  | "collezionista"
  | "marketplace"
  | "scambi"
  | "aste"
  | "community"
  | "advisor"
  | "wishlist"
  | "coins"
  | "recensore"
  | "conversatore"
  | "socialStar"
  | "gruppoMembro"
  | "gruppoLeader"
  | "collezionistaTematico"
  | "gruppoChat"
  | "collezionistaEspositivo"
  | "curatoreTematico"
  | "raritaAssoluta"
  | "valoreSupremo"
  | "venditorePremium"
  | "astaPremium"
  | "scambioPremium"
  | "vetrinaPremium"
  | "analista"
  | "trendHunter"
  | "collezionistaPro"
  | "mercatoMaster"
  | "guardian"
  | "detective"
  | "safeTrader"
  | "communityCleaner"
  | "integrator"
  | "automationMaster"
  | "dataEngineer"
  | "ambassador"
  | "creatorPartner"
  | "revenueMaker"
  | "sellerPro"
  | "topSeller"
  | "powerSeller"
  | "trustedSeller"

/** A single earnable tier within a badge group. */
export interface BadgeTier {
  /** Stable unique id, e.g. "collezionista_gold". */
  id: string
  group: BadgeGroup
  /** Human label shown in the UI (Italian, presentational). */
  label: string
  /** Short description of how it is earned. */
  description: string
  /** Threshold on the group's metric required to unlock. */
  threshold: number
  /** Tailwind accent class for the badge chip. */
  accent: string
}

/** Metrics consumed by the badge engine — one number per badge group. */
export interface BadgeMetrics {
  items: number
  sales: number
  trades: number
  auctionsWon: number
  likesReceived: number
  posts: number
  aiEvaluations: number
  wishlistItems: number
  coinsPurchased: number
  reviewsWritten: number
  conversations: number
  messagesSent: number
  groupPosts: number
  groupMembersLed: number
  groupsJoined: number
  groupMessages: number
  showcaseExposedItems: number
  showcaseThemes: number
  showcaseRareItems: number
  showcaseExposedValue: number
  boostMarketplaceCount: number
  boostAuctionCount: number
  boostTradeCount: number
  boostShowcaseCount: number
  analyticsSnapshots: number
  trendsIdentified: number
  analyticsCollectionValue: number
  marketAnalyzed: number
  // Blocco 37 — moderation metrics.
  guardianReports: number
  detectiveDetections: number
  safeTrades: number
  communityCleaned: number
  // Blocco 38 — public API / integrations metrics.
  apiCalls: number
  webhookDeliveries: number
  analyticsApiCalls: number
  // Blocco 51 — affiliation metrics.
  referralInvites: number
  creatorActivated: number
  creatorUsersInvited: number
  creatorCreditsEarned: number
  // Blocco 41 — professional seller metrics.
  sellerActive: number
  sellerCompletedOrders: number
  sellerTrustedMonths: number
}

/** Display metadata for each group (title + CollexSpark pose). */
export const BADGE_GROUP_META: Record<BadgeGroup, { title: string; pose: string }> = {
  collezionista: { title: "Collezionista", pose: "happy" },
  marketplace: { title: "Marketplace", pose: "deal" },
  scambi: { title: "Scambi", pose: "happy" },
  aste: { title: "Aste", pose: "auction" },
  community: { title: "Community", pose: "happy" },
  advisor: { title: "AI Advisor", pose: "trend" },
  wishlist: { title: "Wishlist", pose: "wishlist" },
  coins: { title: "CollexCoins", pose: "deal" },
  recensore: { title: "Recensore", pose: "happy" },
  conversatore: { title: "Conversatore", pose: "happy" },
  socialStar: { title: "Social Star", pose: "trend" },
  gruppoMembro: { title: "Membro Attivo", pose: "happy" },
  gruppoLeader: { title: "Leader di Gruppo", pose: "trend" },
  collezionistaTematico: { title: "Collezionista Tematico", pose: "happy" },
  gruppoChat: { title: "Chat di Gruppo", pose: "deal" },
  collezionistaEspositivo: { title: "Collezionista Espositivo", pose: "trend" },
  curatoreTematico: { title: "Curatore Tematico", pose: "happy" },
  raritaAssoluta: { title: "Rarità Assoluta", pose: "trend" },
  valoreSupremo: { title: "Valore Supremo", pose: "deal" },
  venditorePremium: { title: "Venditore Premium", pose: "deal" },
  astaPremium: { title: "Asta Premium", pose: "auction" },
  scambioPremium: { title: "Scambio Premium", pose: "happy" },
  vetrinaPremium: { title: "Vetrina Premium", pose: "trend" },
  analista: { title: "Analista", pose: "trend" },
  trendHunter: { title: "Trend Hunter", pose: "trend" },
  collezionistaPro: { title: "Collezionista Pro", pose: "deal" },
  mercatoMaster: { title: "Mercato Master", pose: "auction" },
  guardian: { title: "Guardian", pose: "alert" },
  detective: { title: "Detective", pose: "alert" },
  safeTrader: { title: "Safe Trader", pose: "deal" },
  communityCleaner: { title: "Community Cleaner", pose: "happy" },
  integrator: { title: "Integrator", pose: "deal" },
  automationMaster: { title: "Automation Master", pose: "auction" },
  dataEngineer: { title: "Data Engineer", pose: "trend" },
  ambassador: { title: "Ambassador", pose: "happy" },
  creatorPartner: { title: "Creator Partner", pose: "deal" },
  revenueMaker: { title: "Revenue Maker", pose: "trend" },
  sellerPro: { title: "Seller Pro", pose: "deal" },
  topSeller: { title: "Top Seller", pose: "deal" },
  powerSeller: { title: "Power Seller", pose: "trend" },
  trustedSeller: { title: "Trusted Seller", pose: "deal" },
}

const ACCENTS = {
  bronze: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  silver: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  gold: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  platinum: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300",
}

/** The full official badge catalog (Blocco 27 §3). */
export const BADGE_CATALOG: BadgeTier[] = [
  // Collezionista
  { id: "collezionista_bronze", group: "collezionista", label: "Collezionista Bronze", description: "10 oggetti in collezione", threshold: 10, accent: ACCENTS.bronze },
  { id: "collezionista_silver", group: "collezionista", label: "Collezionista Silver", description: "50 oggetti in collezione", threshold: 50, accent: ACCENTS.silver },
  { id: "collezionista_gold", group: "collezionista", label: "Collezionista Gold", description: "200 oggetti in collezione", threshold: 200, accent: ACCENTS.gold },
  { id: "collezionista_platinum", group: "collezionista", label: "Collezionista Platinum", description: "500 oggetti in collezione", threshold: 500, accent: ACCENTS.platinum },
  // Marketplace
  { id: "marketplace_reliable", group: "marketplace", label: "Venditore affidabile", description: "Prima vendita completata", threshold: 1, accent: ACCENTS.bronze },
  { id: "marketplace_10", group: "marketplace", label: "10 vendite", description: "10 vendite completate", threshold: 10, accent: ACCENTS.silver },
  { id: "marketplace_50", group: "marketplace", label: "50 vendite", description: "50 vendite completate", threshold: 50, accent: ACCENTS.gold },
  { id: "marketplace_100", group: "marketplace", label: "100 vendite", description: "100 vendite completate", threshold: 100, accent: ACCENTS.platinum },
  // Scambi
  { id: "scambi_first", group: "scambi", label: "Primo scambio", description: "Primo scambio completato", threshold: 1, accent: ACCENTS.bronze },
  { id: "scambi_10", group: "scambi", label: "10 scambi", description: "10 scambi completati", threshold: 10, accent: ACCENTS.silver },
  { id: "scambi_50", group: "scambi", label: "50 scambi", description: "50 scambi completati", threshold: 50, accent: ACCENTS.gold },
  // Aste
  { id: "aste_first", group: "aste", label: "Primo rilancio", description: "Prima asta vinta", threshold: 1, accent: ACCENTS.bronze },
  { id: "aste_10", group: "aste", label: "10 aste vinte", description: "10 aste vinte", threshold: 10, accent: ACCENTS.silver },
  { id: "aste_50", group: "aste", label: "50 aste vinte", description: "50 aste vinte", threshold: 50, accent: ACCENTS.gold },
  // Community (likes received, plus first post)
  { id: "community_first", group: "community", label: "Primo post", description: "Primo post pubblicato", threshold: 1, accent: ACCENTS.bronze },
  { id: "community_100", group: "community", label: "100 like ricevuti", description: "100 like ricevuti", threshold: 100, accent: ACCENTS.silver },
  { id: "community_500", group: "community", label: "500 like ricevuti", description: "500 like ricevuti", threshold: 500, accent: ACCENTS.gold },
  { id: "community_1000", group: "community", label: "1000 like ricevuti", description: "1000 like ricevuti", threshold: 1000, accent: ACCENTS.platinum },
  // AI Advisor
  { id: "advisor_first", group: "advisor", label: "Prima valutazione AI", description: "Prima valutazione AI effettuata", threshold: 1, accent: ACCENTS.bronze },
  { id: "advisor_10", group: "advisor", label: "10 valutazioni AI", description: "10 valutazioni AI", threshold: 10, accent: ACCENTS.silver },
  { id: "advisor_50", group: "advisor", label: "50 valutazioni AI", description: "50 valutazioni AI", threshold: 50, accent: ACCENTS.gold },
  { id: "advisor_100", group: "advisor", label: "100 valutazioni AI", description: "100 valutazioni AI", threshold: 100, accent: ACCENTS.platinum },
  // Wishlist
  { id: "wishlist_first", group: "wishlist", label: "Primo desiderio", description: "Primo oggetto in wishlist", threshold: 1, accent: ACCENTS.bronze },
  { id: "wishlist_10", group: "wishlist", label: "10 desideri", description: "10 oggetti in wishlist", threshold: 10, accent: ACCENTS.silver },
  { id: "wishlist_50", group: "wishlist", label: "50 desideri", description: "50 oggetti in wishlist", threshold: 50, accent: ACCENTS.gold },
  // CollexCoins
  { id: "coins_first", group: "coins", label: "Primo acquisto", description: "Primo acquisto di monete", threshold: 1, accent: ACCENTS.bronze },
  { id: "coins_1000", group: "coins", label: "1000 monete", description: "1000 monete acquistate", threshold: 1000, accent: ACCENTS.silver },
  { id: "coins_5000", group: "coins", label: "5000 monete", description: "5000 monete acquistate", threshold: 5000, accent: ACCENTS.gold },
  { id: "coins_10000", group: "coins", label: "10000 monete", description: "10000 monete acquistate", threshold: 10000, accent: ACCENTS.platinum },
  // Recensore (Blocco 28) — reviews authored by the user.
  { id: "recensore_first", group: "recensore", label: "Prima recensione", description: "Prima recensione lasciata", threshold: 1, accent: ACCENTS.bronze },
  { id: "recensore_10", group: "recensore", label: "10 recensioni", description: "10 recensioni lasciate", threshold: 10, accent: ACCENTS.silver },
  { id: "recensore_50", group: "recensore", label: "50 recensioni", description: "50 recensioni lasciate", threshold: 50, accent: ACCENTS.gold },
  { id: "recensore_100", group: "recensore", label: "100 recensioni", description: "100 recensioni lasciate", threshold: 100, accent: ACCENTS.platinum },
  // Conversatore (Blocco 29) — private conversations started/held.
  { id: "conversatore_first", group: "conversatore", label: "Prima conversazione", description: "Prima conversazione avviata", threshold: 1, accent: ACCENTS.bronze },
  { id: "conversatore_10", group: "conversatore", label: "10 conversazioni", description: "10 conversazioni", threshold: 10, accent: ACCENTS.silver },
  { id: "conversatore_50", group: "conversatore", label: "50 conversazioni", description: "50 conversazioni", threshold: 50, accent: ACCENTS.gold },
  { id: "conversatore_100", group: "conversatore", label: "100 conversazioni", description: "100 conversazioni", threshold: 100, accent: ACCENTS.platinum },
  // Social Star (Blocco 29) — total chat messages sent.
  { id: "social_100", group: "socialStar", label: "100 messaggi", description: "100 messaggi inviati", threshold: 100, accent: ACCENTS.silver },
  { id: "social_500", group: "socialStar", label: "500 messaggi", description: "500 messaggi inviati", threshold: 500, accent: ACCENTS.gold },
  { id: "social_1000", group: "socialStar", label: "1000 messaggi", description: "1000 messaggi inviati", threshold: 1000, accent: ACCENTS.platinum },
  // Membro Attivo (Blocco 30) — posts authored inside groups.
  { id: "gruppo_membro_10", group: "gruppoMembro", label: "Membro Attivo", description: "10 post nei gruppi", threshold: 10, accent: ACCENTS.bronze },
  { id: "gruppo_membro_50", group: "gruppoMembro", label: "Membro Assiduo", description: "50 post nei gruppi", threshold: 50, accent: ACCENTS.silver },
  { id: "gruppo_membro_100", group: "gruppoMembro", label: "Pilastro del Gruppo", description: "100 post nei gruppi", threshold: 100, accent: ACCENTS.gold },
  // Leader di Gruppo (Blocco 30) — max members in an administered group.
  { id: "gruppo_leader_admin", group: "gruppoLeader", label: "Fondatore", description: "Amministri un gruppo", threshold: 1, accent: ACCENTS.bronze },
  { id: "gruppo_leader_100", group: "gruppoLeader", label: "Leader 100", description: "Un tuo gruppo ha 100 membri", threshold: 100, accent: ACCENTS.gold },
  { id: "gruppo_leader_500", group: "gruppoLeader", label: "Leader 500", description: "Un tuo gruppo ha 500 membri", threshold: 500, accent: ACCENTS.platinum },
  // Collezionista Tematico (Blocco 30) — number of groups joined.
  { id: "tematico_3", group: "collezionistaTematico", label: "Tematico", description: "Membro di 3 gruppi", threshold: 3, accent: ACCENTS.bronze },
  { id: "tematico_10", group: "collezionistaTematico", label: "Poliedrico", description: "Membro di 10 gruppi", threshold: 10, accent: ACCENTS.silver },
  { id: "tematico_20", group: "collezionistaTematico", label: "Onnipresente", description: "Membro di 20 gruppi", threshold: 20, accent: ACCENTS.gold },
  // Chat di Gruppo (Blocco 30) — messages sent in group chats.
  { id: "gruppo_chat_100", group: "gruppoChat", label: "100 messaggi gruppo", description: "100 messaggi nelle chat di gruppo", threshold: 100, accent: ACCENTS.silver },
  { id: "gruppo_chat_500", group: "gruppoChat", label: "500 messaggi gruppo", description: "500 messaggi nelle chat di gruppo", threshold: 500, accent: ACCENTS.gold },
  { id: "gruppo_chat_1000", group: "gruppoChat", label: "1000 messaggi gruppo", description: "1000 messaggi nelle chat di gruppo", threshold: 1000, accent: ACCENTS.platinum },
  // Collezionista Espositivo (Blocco 32) — items exposed in a public showcase.
  { id: "espositivo_first", group: "collezionistaEspositivo", label: "Prima vetrina", description: "Prima vetrina pubblica", threshold: 1, accent: ACCENTS.bronze },
  { id: "espositivo_10", group: "collezionistaEspositivo", label: "10 esposti", description: "10 oggetti esposti", threshold: 10, accent: ACCENTS.silver },
  { id: "espositivo_50", group: "collezionistaEspositivo", label: "50 esposti", description: "50 oggetti esposti", threshold: 50, accent: ACCENTS.gold },
  { id: "espositivo_100", group: "collezionistaEspositivo", label: "100 esposti", description: "100 oggetti esposti", threshold: 100, accent: ACCENTS.platinum },
  // Curatore Tematico (Blocco 32) — distinct themed categories in the showcase.
  { id: "curatore_first", group: "curatoreTematico", label: "Vetrina tematica", description: "Vetrina con un tema", threshold: 1, accent: ACCENTS.bronze },
  { id: "curatore_3", group: "curatoreTematico", label: "3 temi", description: "3 categorie tematiche esposte", threshold: 3, accent: ACCENTS.silver },
  { id: "curatore_10", group: "curatoreTematico", label: "10 temi", description: "10 categorie tematiche esposte", threshold: 10, accent: ACCENTS.gold },
  // Rarità Assoluta (Blocco 32) — rare items exposed.
  { id: "rarita_5", group: "raritaAssoluta", label: "5 rarità", description: "5 oggetti rari esposti", threshold: 5, accent: ACCENTS.gold },
  { id: "rarita_10", group: "raritaAssoluta", label: "10 rarità", description: "10 oggetti rari esposti", threshold: 10, accent: ACCENTS.platinum },
  // Valore Supremo (Blocco 32) — total exposed value.
  { id: "valore_1k", group: "valoreSupremo", label: "Valore 1K", description: "1.000 di valore esposto", threshold: 1000, accent: ACCENTS.silver },
  { id: "valore_10k", group: "valoreSupremo", label: "Valore 10K", description: "10.000 di valore esposto", threshold: 10000, accent: ACCENTS.gold },
  { id: "valore_50k", group: "valoreSupremo", label: "Valore 50K", description: "50.000 di valore esposto", threshold: 50000, accent: ACCENTS.platinum },
  // Venditore Premium (Blocco 33) — marketplace boosts purchased.
  { id: "boost_market_1", group: "venditorePremium", label: "Primo Boost", description: "Primo boost marketplace", threshold: 1, accent: ACCENTS.bronze },
  { id: "boost_market_10", group: "venditorePremium", label: "10 Boost", description: "10 boost marketplace", threshold: 10, accent: ACCENTS.gold },
  { id: "boost_market_50", group: "venditorePremium", label: "50 Boost", description: "50 boost marketplace", threshold: 50, accent: ACCENTS.platinum },
  // Asta Premium (Blocco 33) — auction boosts purchased.
  { id: "boost_auction_1", group: "astaPremium", label: "Primo Boost Asta", description: "Primo boost asta", threshold: 1, accent: ACCENTS.bronze },
  { id: "boost_auction_10", group: "astaPremium", label: "10 Boost Asta", description: "10 boost aste", threshold: 10, accent: ACCENTS.gold },
  { id: "boost_auction_50", group: "astaPremium", label: "50 Boost Asta", description: "50 boost aste", threshold: 50, accent: ACCENTS.platinum },
  // Scambio Premium (Blocco 33) — trade boosts purchased.
  { id: "boost_trade_1", group: "scambioPremium", label: "Primo Boost Scambio", description: "Primo boost scambio", threshold: 1, accent: ACCENTS.bronze },
  { id: "boost_trade_10", group: "scambioPremium", label: "10 Boost Scambio", description: "10 boost scambi", threshold: 10, accent: ACCENTS.gold },
  { id: "boost_trade_50", group: "scambioPremium", label: "50 Boost Scambio", description: "50 boost scambi", threshold: 50, accent: ACCENTS.platinum },
  // Vetrina Premium (Blocco 33) — showcase boosts purchased.
  { id: "boost_showcase_1", group: "vetrinaPremium", label: "Primo Boost Vetrina", description: "Primo boost vetrina", threshold: 1, accent: ACCENTS.bronze },
  { id: "boost_showcase_10", group: "vetrinaPremium", label: "10 Boost Vetrina", description: "10 boost vetrina", threshold: 10, accent: ACCENTS.gold },
  { id: "boost_showcase_50", group: "vetrinaPremium", label: "50 Boost Vetrina", description: "50 boost vetrina", threshold: 50, accent: ACCENTS.platinum },
  // Analista (Blocco 34) — days the analytics dashboard was opened.
  { id: "analista_1", group: "analista", label: "Primo Accesso", description: "Primo accesso agli analytics", threshold: 1, accent: ACCENTS.bronze },
  { id: "analista_7", group: "analista", label: "7 Giorni", description: "7 giorni di analytics", threshold: 7, accent: ACCENTS.gold },
  { id: "analista_30", group: "analista", label: "30 Giorni", description: "30 giorni di analytics", threshold: 30, accent: ACCENTS.platinum },
  // Trend Hunter (Blocco 34) — trends identified across snapshots.
  { id: "trend_hunter_5", group: "trendHunter", label: "5 Trend", description: "5 trend identificati", threshold: 5, accent: ACCENTS.bronze },
  { id: "trend_hunter_20", group: "trendHunter", label: "20 Trend", description: "20 trend identificati", threshold: 20, accent: ACCENTS.gold },
  { id: "trend_hunter_50", group: "trendHunter", label: "50 Trend", description: "50 trend identificati", threshold: 50, accent: ACCENTS.platinum },
  // Collezionista Pro (Blocco 34) — collection value milestones.
  { id: "collez_pro_1k", group: "collezionistaPro", label: "Valore 1K", description: "1.000 di valore collezione", threshold: 1000, accent: ACCENTS.bronze },
  { id: "collez_pro_10k", group: "collezionistaPro", label: "Valore 10K", description: "10.000 di valore collezione", threshold: 10000, accent: ACCENTS.gold },
  { id: "collez_pro_50k", group: "collezionistaPro", label: "Valore 50K", description: "50.000 di valore collezione", threshold: 50000, accent: ACCENTS.platinum },
  // Mercato Master (Blocco 34) — market analyses performed.
  { id: "mercato_master_50", group: "mercatoMaster", label: "50 Analisi", description: "50 analisi di mercato", threshold: 50, accent: ACCENTS.bronze },
  { id: "mercato_master_100", group: "mercatoMaster", label: "100 Analisi", description: "100 analisi di mercato", threshold: 100, accent: ACCENTS.gold },
  { id: "mercato_master_250", group: "mercatoMaster", label: "250 Analisi", description: "250 analisi di mercato", threshold: 250, accent: ACCENTS.platinum },
  // Guardian (Blocco 37) — content correctly removed via the user's moderation actions.
  { id: "guardian_1", group: "guardian", label: "Guardian", description: "1 contenuto segnalato correttamente", threshold: 1, accent: ACCENTS.bronze },
  { id: "guardian_10", group: "guardian", label: "Guardian 10", description: "10 contenuti segnalati correttamente", threshold: 10, accent: ACCENTS.gold },
  { id: "guardian_50", group: "guardian", label: "Guardian 50", description: "50 contenuti segnalati correttamente", threshold: 50, accent: ACCENTS.platinum },
  // Detective (Blocco 37) — automatic detections handled.
  { id: "detective_10", group: "detective", label: "Detective", description: "10 rilevamenti gestiti", threshold: 10, accent: ACCENTS.bronze },
  { id: "detective_100", group: "detective", label: "Detective Pro", description: "100 rilevamenti gestiti", threshold: 100, accent: ACCENTS.platinum },
  // Safe Trader (Blocco 37) — clean trades with no moderation flags.
  { id: "safe_trader_10", group: "safeTrader", label: "Safe Trader", description: "10 scambi sicuri", threshold: 10, accent: ACCENTS.bronze },
  { id: "safe_trader_50", group: "safeTrader", label: "Safe Trader 50", description: "50 scambi sicuri", threshold: 50, accent: ACCENTS.gold },
  { id: "safe_trader_100", group: "safeTrader", label: "Safe Trader 100", description: "100 scambi sicuri", threshold: 100, accent: ACCENTS.platinum },
  // Community Cleaner (Blocco 37) — clean posts that passed moderation.
  { id: "cleaner_5", group: "communityCleaner", label: "Community Cleaner", description: "5 post ripuliti", threshold: 5, accent: ACCENTS.bronze },
  { id: "cleaner_20", group: "communityCleaner", label: "Cleaner 20", description: "20 post ripuliti", threshold: 20, accent: ACCENTS.gold },
  { id: "cleaner_100", group: "communityCleaner", label: "Cleaner 100", description: "100 post ripuliti", threshold: 100, accent: ACCENTS.platinum },
  // Integrator (Blocco 38) — total public API calls made with the user's keys.
  { id: "integrator_100", group: "integrator", label: "Integrator", description: "100 chiamate API", threshold: 100, accent: ACCENTS.bronze },
  { id: "integrator_1k", group: "integrator", label: "Integrator 1K", description: "1.000 chiamate API", threshold: 1000, accent: ACCENTS.gold },
  { id: "integrator_10k", group: "integrator", label: "Integrator 10K", description: "10.000 chiamate API", threshold: 10000, accent: ACCENTS.platinum },
  // Automation Master (Blocco 38) — successful webhook deliveries.
  { id: "automation_10", group: "automationMaster", label: "Automation Master", description: "10 consegne webhook", threshold: 10, accent: ACCENTS.bronze },
  { id: "automation_100", group: "automationMaster", label: "Automation 100", description: "100 consegne webhook", threshold: 100, accent: ACCENTS.gold },
  { id: "automation_1k", group: "automationMaster", label: "Automation 1K", description: "1.000 consegne webhook", threshold: 1000, accent: ACCENTS.platinum },
  // Data Engineer (Blocco 38) — analytics API calls made.
  { id: "data_eng_50", group: "dataEngineer", label: "Data Engineer", description: "50 chiamate analytics API", threshold: 50, accent: ACCENTS.bronze },
  { id: "data_eng_500", group: "dataEngineer", label: "Data Engineer 500", description: "500 chiamate analytics API", threshold: 500, accent: ACCENTS.platinum },
  // Ambassador (Blocco 51) — amici invitati con successo.
  { id: "ambassador_10", group: "ambassador", label: "Ambassador", description: "10 amici invitati", threshold: 10, accent: ACCENTS.bronze },
  { id: "ambassador_50", group: "ambassador", label: "Ambassador 50", description: "50 amici invitati", threshold: 50, accent: ACCENTS.gold },
  { id: "ambassador_100", group: "ambassador", label: "Ambassador 100", description: "100 amici invitati", threshold: 100, accent: ACCENTS.platinum },
  // Creator Partner (Blocco 51) — attivazione + utenti invitati come creator.
  { id: "creator_active", group: "creatorPartner", label: "Creator Partner", description: "Programma Creator Pro attivato", threshold: 1, accent: ACCENTS.bronze },
  { id: "creator_10", group: "creatorPartner", label: "Creator 10", description: "10 utenti invitati come creator", threshold: 10, accent: ACCENTS.gold },
  { id: "creator_100", group: "creatorPartner", label: "Creator 100", description: "100 utenti invitati come creator", threshold: 100, accent: ACCENTS.platinum },
  // Revenue Maker (Blocco 51) — CreatorCredits generati.
  { id: "revenue_100", group: "revenueMaker", label: "Revenue Maker", description: "100 CreatorCredits generati", threshold: 100, accent: ACCENTS.bronze },
  { id: "revenue_500", group: "revenueMaker", label: "Revenue 500", description: "500 CreatorCredits generati", threshold: 500, accent: ACCENTS.gold },
  { id: "revenue_1000", group: "revenueMaker", label: "Revenue 1000", description: "1.000 CreatorCredits generati", threshold: 1000, accent: ACCENTS.platinum },
  // Seller Pro (Blocco 41) — professional-seller mode activated by an admin.
  { id: "seller_pro", group: "sellerPro", label: "Seller Pro", description: "Modalità Venditore Pro attivata", threshold: 1, accent: ACCENTS.gold },
  // Top Seller (Blocco 41) — 100 completed orders.
  { id: "top_seller_100", group: "topSeller", label: "Top Seller", description: "100 ordini completati", threshold: 100, accent: ACCENTS.silver },
  // Power Seller (Blocco 41) — 1000 completed orders.
  { id: "power_seller_1000", group: "powerSeller", label: "Power Seller", description: "1.000 ordini completati", threshold: 1000, accent: ACCENTS.platinum },
  // Trusted Seller (Blocco 41) — rating >= 4.8 sustained for 6 months.
  { id: "trusted_seller", group: "trustedSeller", label: "Trusted Seller", description: "Rating ≥ 4.8 per 6 mesi", threshold: 6, accent: ACCENTS.gold },
]

/** Maps a badge group to the metric that unlocks it. */
function metricForGroup(group: BadgeGroup, m: BadgeMetrics): number {
  switch (group) {
    case "collezionista":
      return m.items
    case "marketplace":
      return m.sales
    case "scambi":
      return m.trades
    case "aste":
      return m.auctionsWon
    case "community":
      // The "first post" tier uses posts; like tiers use likes. We expose the
      // larger qualifying signal so both unlock correctly via per-tier checks.
      return Math.max(m.likesReceived, m.posts >= 1 ? 1 : 0)
    case "advisor":
      return m.aiEvaluations
    case "wishlist":
      return m.wishlistItems
    case "coins":
      return m.coinsPurchased
    case "recensore":
      return m.reviewsWritten
    case "conversatore":
      return m.conversations
    case "socialStar":
      return m.messagesSent
    case "gruppoMembro":
      return m.groupPosts
    case "gruppoLeader":
      return m.groupMembersLed
    case "collezionistaTematico":
      return m.groupsJoined
    case "gruppoChat":
      return m.groupMessages
    case "collezionistaEspositivo":
      return m.showcaseExposedItems
    case "curatoreTematico":
      return m.showcaseThemes
    case "raritaAssoluta":
      return m.showcaseRareItems
    case "valoreSupremo":
      return m.showcaseExposedValue
    case "venditorePremium":
      return m.boostMarketplaceCount
    case "astaPremium":
      return m.boostAuctionCount
    case "scambioPremium":
      return m.boostTradeCount
    case "vetrinaPremium":
      return m.boostShowcaseCount
    case "analista":
      return m.analyticsSnapshots
    case "trendHunter":
      return m.trendsIdentified
    case "collezionistaPro":
      return m.analyticsCollectionValue
    case "mercatoMaster":
      return m.marketAnalyzed
    case "guardian":
      return m.guardianReports
    case "detective":
      return m.detectiveDetections
    case "safeTrader":
      return m.safeTrades
    case "communityCleaner":
      return m.communityCleaned
    case "integrator":
      return m.apiCalls
    case "automationMaster":
      return m.webhookDeliveries
    case "dataEngineer":
      return m.analyticsApiCalls
    case "ambassador":
      return m.referralInvites
    case "creatorPartner":
      // Higher tiers use invited-user count; the activation tier is special-cased.
      return m.creatorUsersInvited
    case "revenueMaker":
      return m.creatorCreditsEarned
    case "sellerPro":
      return m.sellerActive
    case "topSeller":
      return m.sellerCompletedOrders
    case "powerSeller":
      return m.sellerCompletedOrders
    case "trustedSeller":
      return m.sellerTrustedMonths
  }
}

/** Returns whether a specific tier is earned given the metrics. */
function isTierEarned(tier: BadgeTier, m: BadgeMetrics): boolean {
  // Special case: the community "first post" tier is gated on posts, not likes.
  if (tier.id === "community_first") return m.posts >= 1
  // Special case: Creator Partner activation tier is gated on activation, not invites.
  if (tier.id === "creator_active") return m.creatorActivated >= 1
  return metricForGroup(tier.group, m) >= tier.threshold
}

export interface EarnedBadge extends BadgeTier {
  earned: boolean
  /** Current progress value toward this tier's metric. */
  progress: number
}

/**
 * Evaluates the whole catalog against the metrics, returning every badge with
 * an `earned` flag and current progress (for locked-badge progress bars).
 */
export function computeBadges(m: BadgeMetrics): EarnedBadge[] {
  return BADGE_CATALOG.map((tier) => ({
    ...tier,
    earned: isTierEarned(tier, m),
    progress: tier.id === "community_first" ? m.posts : metricForGroup(tier.group, m),
  }))
}

/** Convenience: just the ids of earned badges. */
export function earnedBadgeIds(m: BadgeMetrics): string[] {
  return computeBadges(m)
    .filter((b) => b.earned)
    .map((b) => b.id)
}

// ---------------------------------------------------------------------------
// Levels (Blocco 27 §4) — derived from the 0-100 reputation score.
// ---------------------------------------------------------------------------

export interface UserLevel {
  level: number
  name: string
  /** Reputation score at which this level begins. */
  min: number
  /** Score at which the next level begins (null for the top level). */
  next: number | null
}

const LEVELS: { level: number; name: string; min: number }[] = [
  { level: 1, name: "Novizio", min: 0 },
  { level: 2, name: "Collezionista", min: 20 },
  { level: 3, name: "Esperto", min: 45 },
  { level: 4, name: "Maestro", min: 70 },
  { level: 5, name: "Leggenda", min: 90 },
]

/** Maps a reputation score (0-100) to the user level. */
export function levelFromScore(score: number): UserLevel {
  let current = LEVELS[0]
  for (const l of LEVELS) {
    if (score >= l.min) current = l
  }
  const idx = LEVELS.findIndex((l) => l.level === current.level)
  const next = idx < LEVELS.length - 1 ? LEVELS[idx + 1].min : null
  return { level: current.level, name: current.name, min: current.min, next }
}
