import type { ScenarioInput } from "./invoice-model.js";

/** Les neuf cas pièges du design. Sans eux, tous les modèles finissent à 95 %. */
export const TRAPS = [
  "multi_tva", "avoir", "remise_pied", "acompte", "franchise_293b",
  "autoliquidation", "scan_degrade", "devise_etrangere", "deux_pages",
] as const;
export type Trap = (typeof TRAPS)[number];

export type TemplateId = "sobre" | "tableau" | "colore";

export type Scenario = {
  id: string;
  template: TemplateId;
  traps?: Trap[];
  input: ScenarioInput;
};

const l = (designation: string, quantite: number, prixUnitaireHT: number, tauxTVA: number | null = 20) =>
  ({ designation, quantite, prixUnitaireHT, tauxTVA });

export const SCENARIOS: Scenario[] = [
  // ---- Factures nominales ----
  { id: "f-001", template: "sobre", input: { id: "f-001", lines: [l("Maintenance préventive annuelle", 1, 1450)] } },
  { id: "f-002", template: "tableau", input: { id: "f-002", lines: [
    l("Cartouche toner noir", 4, 89.9), l("Ramette papier A4 80g", 20, 4.15)] } },
  { id: "f-003", template: "colore", input: { id: "f-003", lines: [
    l("Prestation de conseil — mars 2026", 7, 850)] } },
  { id: "f-004", template: "sobre", input: { id: "f-004", withTvaIntracom: false, lines: [
    l("Remplacement pompe hydraulique", 1, 2340.5), l("Main d'œuvre", 6, 68)] } },
  { id: "f-005", template: "tableau", input: { id: "f-005", lines: [
    l("Licence logicielle — 12 mois", 3, 420), l("Formation utilisateurs", 2, 950)] } },
  { id: "f-006", template: "colore", input: { id: "f-006", echeanceDays: null, lines: [
    l("Nettoyage de fin de chantier", 1, 780)] } },
  { id: "f-007", template: "sobre", input: { id: "f-007", lines: [
    l("Transport palettes Lyon-Nantes", 3, 215.4)] } },
  { id: "f-008", template: "tableau", input: { id: "f-008", lines: [
    l("Étude thermique", 1, 3200), l("Rapport d'expertise", 1, 640), l("Déplacement", 2, 120)] } },
  { id: "f-009", template: "colore", input: { id: "f-009", lines: [l("Abonnement hébergement", 12, 39.9)] } },

  // ---- Multi-taux de TVA ----
  { id: "f-010", template: "sobre", traps: ["multi_tva"], input: { id: "f-010", lines: [
    l("Repas séminaire", 24, 18.5, 10), l("Location salle", 1, 640, 20)] } },
  { id: "f-011", template: "tableau", traps: ["multi_tva"], input: { id: "f-011", lines: [
    l("Ouvrage technique", 12, 34.9, 5.5), l("Reliure et façonnage", 12, 6.2, 20)] } },
  { id: "f-012", template: "colore", traps: ["multi_tva"], input: { id: "f-012", lines: [
    l("Travaux de rénovation énergétique", 1, 8400, 5.5),
    l("Fourniture matériel neuf", 1, 2150, 20),
    l("Entretien courant", 1, 600, 10)] } },

  // ---- Avoirs ----
  { id: "f-013", template: "sobre", traps: ["avoir"], input: { id: "f-013", isCreditNote: true, lines: [
    l("Retour marchandise non conforme", 2, 340)] } },
  { id: "f-014", template: "tableau", traps: ["avoir"], input: { id: "f-014", isCreditNote: true, lines: [
    l("Annulation prestation du 12/02", 1, 1250), l("Geste commercial", 1, 150)] } },

  // ---- Remise en pied de facture ----
  { id: "f-015", template: "colore", traps: ["remise_pied"], input: { id: "f-015", globalDiscountPct: 15, lines: [
    l("Campagne d'affichage", 1, 5600)] } },
  { id: "f-016", template: "sobre", traps: ["remise_pied"], input: { id: "f-016", globalDiscountPct: 7.5, lines: [
    l("Pièces détachées série B", 40, 27.3), l("Frais de port", 1, 85)] } },

  // ---- Acompte déjà versé ----
  { id: "f-017", template: "tableau", traps: ["acompte"], input: { id: "f-017", deposit: 1800, lines: [
    l("Chantier menuiserie — solde", 1, 6200)] } },
  { id: "f-018", template: "colore", traps: ["acompte"], input: { id: "f-018", deposit: 450, lines: [
    l("Développement sur mesure", 1, 3500), l("Recette et mise en production", 1, 800)] } },

  // ---- Exonérations : la TVA est absente, pas nulle ----
  { id: "f-019", template: "sobre", traps: ["franchise_293b"], input: { id: "f-019", vatExempt: "293B",
    withTvaIntracom: false, lines: [l("Graphisme identité visuelle", 1, 1600, null)] } },
  { id: "f-020", template: "tableau", traps: ["franchise_293b"], input: { id: "f-020", vatExempt: "293B",
    withTvaIntracom: false, echeanceDays: null, lines: [
      l("Rédaction web — forfait", 1, 900, null), l("Relecture", 3, 60, null)] } },
  { id: "f-021", template: "colore", traps: ["autoliquidation"], input: { id: "f-021",
    vatExempt: "autoliquidation", lines: [
      l("Sous-traitance gros œuvre", 1, 14500, null), l("Location échafaudage", 1, 2200, null)] } },

  // ---- Qualité d'image dégradée ----
  { id: "f-022", template: "sobre", traps: ["scan_degrade"], input: { id: "f-022", lines: [
    l("Contrôle réglementaire annuel", 1, 590), l("Mise en conformité", 1, 1240)] } },
  { id: "f-023", template: "tableau", traps: ["scan_degrade", "multi_tva"], input: { id: "f-023", lines: [
    l("Menu traiteur", 45, 22, 10), l("Boissons", 45, 6.5, 20), l("Service", 1, 480, 20)] } },

  // ---- Devise étrangère ----
  { id: "f-024", template: "colore", traps: ["devise_etrangere"], input: { id: "f-024", currency: "CHF",
    withTvaIntracom: false, lines: [l("Consulting mission Genève", 5, 1200, null)], vatExempt: "autoliquidation" } },

  // ---- Facture longue, sur deux pages ----
  { id: "f-025", template: "sobre", traps: ["deux_pages"], input: { id: "f-025", lines: [
    l("Serrure 3 points", 6, 148), l("Cylindre européen", 6, 62.5), l("Poignée inox", 12, 34),
    l("Ferme-porte hydraulique", 4, 195), l("Butée de sol", 12, 11.9), l("Joint isophonique", 30, 4.6),
    l("Paumelle réglable", 24, 8.75), l("Pose et réglage", 18, 58),
    l("Déplacement forfaitaire", 3, 95), l("Évacuation déchets", 1, 140)] } },
];

export const scenarioById = (id: string): Scenario | undefined => SCENARIOS.find((s) => s.id === id);
