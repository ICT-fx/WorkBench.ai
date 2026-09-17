import type { GroundTruth } from "@hub/schema";

export type Line = {
  designation: string;
  quantite: number;
  prixUnitaireHT: number;
  /** null en franchise en base ou en autoliquidation. */
  tauxTVA: number | null;
};

export type VatExemption = "293B" | "autoliquidation";

export type ScenarioInput = {
  id: string;
  lines: Line[];
  isCreditNote?: boolean;
  vatExempt?: VatExemption;
  /** Remise en pied de facture, en pourcentage, appliquée avant la TVA. */
  globalDiscountPct?: number;
  /** Acompte déjà versé : creuse l'écart entre total TTC et net à payer. */
  deposit?: number;
  currency?: "EUR" | "USD" | "CHF";
  /** Délai de règlement en jours. `null` = la facture n'en porte pas. */
  echeanceDays?: number | null;
  withTvaIntracom?: boolean;
};

export type Party = { nom: string; adresse: string; siret: string; tvaIntracom: string | null };

export type Invoice = {
  id: string;
  numero: string;
  dateEmission: string;
  echeance: string | null;
  emetteur: Party;
  client: { nom: string; adresse: string };
  lines: (Line & { montantHT: number })[];
  totalHT: number;
  totalTVA: number | null;
  totalTTC: number;
  netAPayer: number | null;
  mentions: string[];
  currency: "EUR" | "USD" | "CHF";
  globalDiscountPct: number | null;
  isCreditNote: boolean;
};

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Générateur déterministe : la même facture doit sortir à chaque exécution. */
function rng(seed: string): () => number {
  let h = 2166136261;
  for (const ch of seed) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(rand: () => number, xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;

// Entreprises entièrement fictives : le dépôt est public, aucune donnée réelle.
const EMETTEURS = [
  { nom: "Ateliers Vaubourg SARL", adresse: "14 rue des Frères Lumière, 69008 Lyon" },
  { nom: "Groupe Mérindol", adresse: "3 avenue de la Gare, 33000 Bordeaux" },
  { nom: "Technilec SAS", adresse: "Zone d'activité du Pré Long, 44800 Saint-Herblain" },
  { nom: "Papeterie Cassegrain", adresse: "27 boulevard Carnot, 59000 Lille" },
  { nom: "Bureau d'études Halvard", adresse: "9 place du Marché, 67000 Strasbourg" },
  { nom: "SARL Pontivy Maintenance", adresse: "5 impasse des Tilleuls, 56300 Pontivy" },
] as const;

const CLIENTS = [
  { nom: "Flowera SAS", adresse: "18 rue Sainte-Catherine, 44000 Nantes" },
  { nom: "Établissements Roussillon", adresse: "42 route de Toulouse, 31200 Toulouse" },
  { nom: "Compagnie du Ponant Textile", adresse: "7 quai Malakoff, 44000 Nantes" },
] as const;

function luhnComplete(first13: string): string {
  const sum = first13.split("").reduce((acc, c, i) => {
    const d = Number(c);
    const doubled = i % 2 === 0 ? d * 2 : d;
    return acc + (doubled > 9 ? doubled - 9 : doubled);
  }, 0);
  return first13 + String((10 - (sum % 10)) % 10);
}

function makeSiret(rand: () => number): string {
  let first13 = "";
  for (let i = 0; i < 13; i++) first13 += String(Math.floor(rand() * 10));
  return luhnComplete(first13);
}

/** Clé TVA française : (12 + 3 × (SIREN mod 97)) mod 97. */
function makeTvaIntracom(siret: string): string {
  const siren = Number(siret.slice(0, 9));
  const cle = (12 + 3 * (siren % 97)) % 97;
  return `FR${String(cle).padStart(2, "0")}${siret.slice(0, 9)}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function buildInvoice(input: ScenarioInput): Invoice {
  const rand = rng(input.id);
  const emetteurBase = pick(rand, EMETTEURS);
  const siret = makeSiret(rand);
  const sign = input.isCreditNote ? -1 : 1;
  const discount = input.globalDiscountPct ?? 0;

  const lines = input.lines.map((l) => {
    const brut = round2(l.quantite * l.prixUnitaireHT);
    return { ...l, montantHT: round2(sign * brut * (1 - discount / 100)) };
  });

  const totalHT = round2(lines.reduce((acc, l) => acc + l.montantHT, 0));

  const exempt = input.vatExempt !== undefined;
  const totalTVA = exempt
    ? null
    : round2(lines.reduce((acc, l) => acc + round2(l.montantHT * ((l.tauxTVA ?? 0) / 100)), 0));

  const totalTTC = round2(totalHT + (totalTVA ?? 0));

  const mentions: string[] = [];
  if (input.isCreditNote) mentions.push("AVOIR");
  if (input.vatExempt === "293B") mentions.push("TVA non applicable, article 293 B du CGI");
  if (input.vatExempt === "autoliquidation") {
    mentions.push("Autoliquidation — article 283-2 nonies du CGI");
  }
  if (input.deposit !== undefined) {
    mentions.push(`Acompte de ${input.deposit.toFixed(2)} € déjà versé`);
  }

  const dateEmission = `2026-${String(1 + Math.floor(rand() * 9)).padStart(2, "0")}-${String(1 + Math.floor(rand() * 27)).padStart(2, "0")}`;
  const echeanceDays = input.echeanceDays === undefined ? 30 : input.echeanceDays;

  return {
    id: input.id,
    numero: `${input.isCreditNote ? "AV" : "FA"}-2026-${String(Math.floor(rand() * 9000) + 1000)}`,
    dateEmission,
    echeance: echeanceDays === null ? null : addDays(dateEmission, echeanceDays),
    emetteur: {
      ...emetteurBase,
      siret,
      tvaIntracom: input.withTvaIntracom === false ? null : makeTvaIntracom(siret),
    },
    client: pick(rand, CLIENTS),
    lines,
    totalHT,
    totalTVA,
    totalTTC,
    netAPayer: input.deposit === undefined ? null : round2(totalTTC - input.deposit),
    mentions,
    currency: input.currency ?? "EUR",
    globalDiscountPct: discount === 0 ? null : discount,
    isCreditNote: input.isCreditNote ?? false,
  };
}

/** La vérité terrain : exactement les dix clés du barème, `null` pour toute absence. */
export function toGroundTruth(inv: Invoice): GroundTruth {
  return {
    docId: inv.id,
    fields: {
      numero_facture: inv.numero,
      date_emission: inv.dateEmission,
      siret_emetteur: inv.emetteur.siret,
      tva_intracom: inv.emetteur.tvaIntracom,
      total_ht: inv.totalHT,
      total_tva: inv.totalTVA,
      total_ttc: inv.totalTTC,
      echeance: inv.echeance,
      lignes: inv.lines.map((l) => ({
        designation: l.designation,
        quantite: l.quantite,
        prix_unitaire_ht: l.prixUnitaireHT,
        taux_tva: l.tauxTVA,
      })),
      mentions_speciales: inv.mentions.length > 0 ? inv.mentions.join(" · ") : null,
    },
  };
}
