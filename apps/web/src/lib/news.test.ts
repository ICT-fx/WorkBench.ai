import { describe, expect, it } from "vitest";
import type { Benchmark, Domain, Lab, Leaderboard, LeaderboardRow, Model, News } from "@hub/schema";
import { getDictionary } from "@/i18n";
import { date } from "./format";
import { buildHub } from "./hub";
import { bodyBlocks, editorialNews, mergeNews, modelReports, typo } from "./news";

const lab = (id: string): Lab => ({ id, name: `Labo ${id}`, country: "FR", monogram: "L", url: "https://exemple.fr" });

const model = (id: string, released: string, over: Partial<Model> = {}): Model => ({
  id, name: id.split("/")[1]!, lab: id.split("/")[0]!, released, weights: "fermes",
  contextWindow: null, maxOutput: null, priceIn: 1, priceOut: 2, modalities: ["text", "image"], reasoning: false, ...over,
});

const benchmark = (id: string, domain: string, input: Benchmark["input"] = "texte"): Benchmark => ({
  id, domain, label: { fr: id, en: id }, question: { fr: "?", en: "?" }, description: { fr: "d", en: "d" },
  input, unit: { fr: "cas", en: "case" }, sampleSize: 10,
  subtasks: [{ id: "a", label: { fr: "A", en: "A" } }, { id: "b", label: { fr: "B", en: "B" } }],
  maturity: "maquette",
});

const row = (m: string, exactitude: number, over: Partial<LeaderboardRow> = {}): LeaderboardRow => ({
  model: m, modelVersion: "v", sansRelecture: 50, exactitude, hallucinations: 2,
  costPerDoc: 0.01, latencyP50: 1000, errorCount: 0, docCount: 10, ...over,
});

const leaderboard = (taskId: string, rows: LeaderboardRow[], status: "reel" | "demo" = "reel"): Leaderboard => ({
  taskId, runId: `2026-09-15_${taskId}`, status, runDate: "2026-09-15", sampleSize: 10, excluded: 0, rows,
});

const domains: Domain[] = [
  { id: "finance", label: { fr: "Finance", en: "Finance" }, summary: { fr: "s", en: "s" }, icon: "finance" },
  { id: "rh", label: { fr: "Ressources humaines", en: "Human resources" }, summary: { fr: "s", en: "s" }, icon: "rh" },
  { id: "juridique", label: { fr: "Juridique", en: "Legal" }, summary: { fr: "s", en: "s" }, icon: "juridique" },
];

const benchmarks = [
  benchmark("f-texte", "finance"), benchmark("f-doc", "finance", "document"),
  benchmark("r-texte", "rh"), benchmark("j-texte", "juridique"),
];

/** Un hub daté du 15 septembre 2026 : la fenêtre des comptes rendus s'ouvre le 18 mai. */
function hubDe(models: Model[], scoresParModele: Record<string, Partial<Record<string, number>>>, status: "reel" | "demo" = "reel") {
  const leaderboards = benchmarks.map((b) => leaderboard(
    b.id,
    models.flatMap((m) => {
      const ex = scoresParModele[m.id]?.[b.id];
      return ex === undefined ? [] : [row(m.id, ex, { costPerDoc: m.priceIn === null ? 0 : m.priceIn / 100, ci: 2 })];
    }),
    status,
  ));
  return buildHub({ labs: [lab("a"), lab("b")], models, domains, benchmarks, leaderboards });
}

const partout = (ex: number) => ({ "f-texte": ex, "f-doc": ex, "r-texte": ex, "j-texte": ex });
const catalogue = { domains, benchmarks };
const t = getDictionary("fr").news.report;

describe("comptes rendus rédigés à partir des classements", () => {
  it("ne rédige de compte rendu que pour les modèles sortis dans les 120 jours avant la dernière publication", () => {
    const hub = hubDe(
      [model("a/limite", "2026-05-18"), model("a/trop-ancien", "2026-05-17"), model("a/recent", "2026-09-01"), model("a/futur", "2026-09-16")],
      { "a/limite": partout(70), "a/trop-ancien": partout(60), "a/recent": partout(80), "a/futur": partout(90) },
    );
    expect(modelReports(hub, catalogue, "fr").map((n) => n.model).sort()).toEqual(["a/limite", "a/recent"]);
  });

  it("ne dit rien d'un modèle récent qui n'a passé aucun benchmark", () => {
    const hub = hubDe([model("a/teste", "2026-09-01"), model("a/absent", "2026-09-01")], { "a/teste": partout(80) });
    expect(modelReports(hub, catalogue, "fr").map((n) => n.model)).toEqual(["a/teste"]);
  });

  it("date le compte rendu deux jours après la sortie, sans jamais dépasser la dernière publication", () => {
    const hub = hubDe(
      [model("a/juillet", "2026-07-09"), model("a/veille", "2026-09-14"), model("a/jour-meme", "2026-09-15")],
      { "a/juillet": partout(70), "a/veille": partout(71), "a/jour-meme": partout(72) },
    );
    const dates = Object.fromEntries(modelReports(hub, catalogue, "fr").map((n) => [n.model, n.date]));
    expect(dates).toEqual({ "a/juillet": "2026-07-11", "a/veille": "2026-09-15", "a/jour-meme": "2026-09-15" });
  });

  it("donne à chaque compte rendu l'adresse de la fiche du modèle, le type « modèle » et la marque d'article généré", () => {
    const hub = hubDe([model("a/claude-5.1", "2026-09-01")], { "a/claude-5.1": partout(80) });
    const [n] = modelReports(hub, catalogue, "fr");
    expect(n).toMatchObject({ slug: "evaluation-a_claude-5-1", kind: "modele", auto: true, featured: false, model: "a/claude-5.1" });
    expect(n!.title).toBe("claude-5.1 évalué sur les 4 benchmarks du hub");
  });

  it("parle au singulier tant qu'un seul benchmark est mesuré", () => {
    // Le hub n'en a mesuré qu'un : « les 1 benchmarks du hub » trahirait un
    // gabarit là où le lecteur attend une phrase.
    const seul = [benchmark("f-texte", "finance")];
    const hub = buildHub({
      labs: [lab("a")], models: [model("a/un", "2026-09-01")], domains, benchmarks: seul,
      leaderboards: [leaderboard("f-texte", [row("a/un", 80, { ci: 2 })])],
    });
    const [n] = modelReports(hub, { domains, benchmarks: seul }, "fr");
    expect(n!.title).toBe("un évalué sur le seul benchmark du hub");
    expect(n!.body.at(-1)).toBe("- Il a passé le seul benchmark publié du hub.");
  });

  it("ouvre le corps par l'avertissement quand un classement est une démonstration, et le redit dans le résumé", () => {
    const hub = hubDe([model("a/un", "2026-09-01")], { "a/un": partout(80) }, "demo");
    const [n] = modelReports(hub, catalogue, "fr");
    expect(n!.body[0]).toBe(`- ${t.demoWarning}`);
    expect(n!.summary).toContain("scores de démonstration");
  });

  it("n'avertit de rien quand tous les classements sont des mesures", () => {
    const hub = hubDe([model("a/un", "2026-09-01")], { "a/un": partout(80) });
    const [n] = modelReports(hub, catalogue, "fr");
    expect(n!.body.join(" ")).not.toContain("démonstration");
    expect(n!.summary).not.toContain("démonstration");
  });

  it("dit qu'un modèle n'a pas d'indice au lieu de lui inventer un rang", () => {
    const hub = hubDe(
      [model("a/complet", "2026-09-01"), model("a/partiel", "2026-09-01")],
      { "a/complet": partout(80), "a/partiel": { "f-texte": 90, "r-texte": 85 } },
    );
    const partiel = modelReports(hub, catalogue, "fr").find((n) => n.model === "a/partiel")!;
    expect(partiel.body[0]).toBe(`- ${t.noIndex}`);
    expect(partiel.body.join(" ")).not.toMatch(/sur 1 à l'indice/);
    expect(partiel.title).toBe("partiel évalué sur 2 des 4 benchmarks du hub");
  });

  it("donne le rang à l'indice parmi les seuls modèles classés, avec la marge d'erreur", () => {
    const hub = hubDe(
      [model("a/premier", "2026-09-01"), model("a/second", "2026-09-02"), model("a/sans-indice", "2026-09-03")],
      { "a/premier": partout(80), "a/second": partout(70), "a/sans-indice": { "f-texte": 99 } },
    );
    const second = modelReports(hub, catalogue, "fr").find((n) => n.model === "a/second")!;
    expect(second.body[0]).toMatch(/^- 2e sur 2 à l'indice métier, avec 70,0\s%/);
    expect(second.body[0]).toContain("± 1,0 point)");
  });

  it("mesure l'écart d'indice avec le modèle précédent du même labo, et dit quand il ne départage rien", () => {
    const hub = hubDe(
      [model("a/v1", "2026-03-01"), model("a/v2", "2026-08-01"), model("a/v3", "2026-09-01"), model("b/autre", "2026-08-15")],
      { "a/v1": partout(60), "a/v2": partout(75.5), "a/v3": partout(76), "b/autre": partout(90) },
    );
    const parModele = Object.fromEntries(modelReports(hub, catalogue, "fr").map((n) => [n.model, n.body.join("\n")]));
    expect(parModele["a/v2"]).toContain(`15,5 points d'indice de plus que v1, son prédécesseur chez Labo a, sorti le ${date("2026-03-01", "fr", "long")}.`);
    expect(parModele["a/v2"]).not.toContain(t.deltaWithinMargin);
    // Un demi-point d'écart pour une marge d'un point : v3 ne fait pas mieux que v2.
    expect(parModele["a/v3"]).toContain(`0,5 point d'indice de plus que v2, son prédécesseur chez Labo a, sorti le ${date("2026-08-01", "fr", "long")}. ${t.deltaWithinMargin}`);
    expect(parModele["b/autre"]).not.toContain("prédécesseur");
  });

  it("nomme les deux meilleurs métiers et le plus faible", () => {
    const hub = hubDe([model("a/un", "2026-09-01")], { "a/un": { "f-texte": 90, "f-doc": 70, "r-texte": 60, "j-texte": 85 } });
    const [n] = modelReports(hub, catalogue, "fr");
    expect(n!.body.join("\n")).toMatch(/Juridique \(85,0\s%\) et Finance \(80,0\s%\)\. Le plus faible : Ressources humaines \(60,0\s%\)\./);
  });

  it("situe le coût parmi les modèles dont le tarif est connu", () => {
    const hub = hubDe(
      [
        model("a/econome", "2026-09-01", { priceIn: 0.5 }), model("a/moyen", "2026-09-01", { priceIn: 2 }),
        model("a/cher", "2026-09-01", { priceIn: 9 }), model("a/secret", "2026-09-01", { priceIn: null, priceOut: null }),
      ],
      { "a/econome": partout(60), "a/moyen": partout(70), "a/cher": partout(80), "a/secret": partout(75) },
    );
    const parModele = Object.fromEntries(modelReports(hub, catalogue, "fr").map((n) => [n.model, n.body.join("\n")]));
    expect(parModele["a/econome"]).toContain("le moins cher des 3 modèles dont le tarif est connu");
    expect(parModele["a/moyen"]).toContain("le 2e moins cher des 3 modèles dont le tarif est connu");
    expect(parModele["a/cher"]).toContain("le plus cher des 3 modèles dont le tarif est connu");
    expect(parModele["a/secret"]).toContain(t.costUnknown);
  });

  it("explique pourquoi un modèle qui ne lit pas les documents a passé moins de benchmarks", () => {
    const hub = hubDe(
      [model("a/lecteur", "2026-09-01"), model("a/texte-seul", "2026-09-01", { modalities: ["text"] })],
      { "a/lecteur": partout(80), "a/texte-seul": { "f-texte": 80, "r-texte": 80, "j-texte": 80 } },
    );
    const parModele = Object.fromEntries(modelReports(hub, catalogue, "fr").map((n) => [n.model, n]));
    expect(parModele["a/lecteur"]!.body.at(-1)).toBe("- Il a passé les 4 benchmarks du hub.");
    expect(parModele["a/texte-seul"]!.body.at(-1)).toContain("Benchmarks passés : 3 sur 4. Il ne lit ni image ni PDF");
    expect(parModele["a/texte-seul"]!.title).toBe("texte-seul évalué sur 3 des 4 benchmarks du hub");
  });

  it("ne compte pas comme manqué un benchmark du catalogue qui n'a aucun classement publié", () => {
    const hub = hubDe([model("a/un", "2026-09-01")], { "a/un": partout(80) });
    const [n] = modelReports(hub, { domains, benchmarks: [...benchmarks, benchmark("pas-encore-publie", "rh")] }, "fr");
    expect(n!.title).toBe("un évalué sur les 4 benchmarks du hub");
  });

  it("rédige en anglais avec les ordinaux et les formats anglais", () => {
    const hub = hubDe(
      [model("a/premier", "2026-09-01"), model("a/second", "2026-09-02"), model("a/troisieme", "2026-09-03")],
      { "a/premier": partout(80), "a/second": partout(70), "a/troisieme": partout(60) },
    );
    const troisieme = modelReports(hub, catalogue, "en").find((n) => n.model === "a/troisieme")!;
    expect(troisieme.title).toBe("troisieme evaluated on the hub's 4 benchmarks");
    expect(troisieme.body[0]).toContain("3rd of 3 on the Business Index, at 60.0%");
    expect(troisieme.body.join("\n")).toContain("10.0 index points below second");
  });

  it("ne rédige rien tant qu'aucun classement n'est publié", () => {
    const hub = buildHub({ labs: [lab("a")], models: [model("a/un", "2026-09-01")], domains, benchmarks, leaderboards: [] });
    expect(modelReports(hub, catalogue, "fr")).toEqual([]);
  });
});

describe("liste des actualités", () => {
  const article = (slug: string, date: string, over: Partial<News> = {}): News => ({
    slug, date, kind: "analyse", featured: false,
    title: { fr: `Titre ${slug}`, en: `Title ${slug}` }, summary: { fr: "Résumé", en: "Summary" },
    body: { fr: ["Corps"], en: ["Body"] }, ...over,
  });

  it("mêle articles rédigés et comptes rendus générés, du plus récent au plus ancien", () => {
    const hub = hubDe(
      [model("a/juillet", "2026-07-09"), model("a/septembre", "2026-09-01")],
      { "a/juillet": partout(70), "a/septembre": partout(80) },
    );
    const items = mergeNews(
      [...editorialNews([article("ancien", "2026-06-01"), article("recent", "2026-09-10"), article("milieu", "2026-08-01")], "fr"), ...modelReports(hub, catalogue, "fr")],
      "fr",
    );
    expect(items.map((n) => n.slug)).toEqual(["recent", "evaluation-a_septembre", "milieu", "evaluation-a_juillet", "ancien"]);
  });

  it("départage deux articles du même jour par leur adresse, quel que soit l'ordre d'arrivée", () => {
    const a = editorialNews([article("b-second", "2026-09-01"), article("a-premier", "2026-09-01")], "fr");
    expect(mergeNews(a, "fr").map((n) => n.slug)).toEqual(["a-premier", "b-second"]);
    expect(mergeNews([...a].reverse(), "fr").map((n) => n.slug)).toEqual(["a-premier", "b-second"]);
  });

  it("sert chaque article dans la langue demandée, sans le marquer comme généré", () => {
    const [n] = editorialNews([article("un", "2026-09-01", { benchmark: "facture-fr", featured: true })], "en");
    expect(n).toMatchObject({ title: "Title un", summary: "Summary", body: ["Body"], auto: false, featured: true, benchmark: "facture-fr" });
  });

  it("refuse deux actualités à la même adresse", () => {
    const doublon = editorialNews([article("meme", "2026-09-01"), article("meme", "2026-09-02")], "fr");
    expect(() => mergeNews(doublon, "fr")).toThrow(/même adresse/);
  });
});

describe("mise en forme du texte", () => {
  it("regroupe les lignes à tiret qui se suivent en une liste", () => {
    expect(bodyBlocks(["Intro :", "- un", "- deux", "Suite.", "- seul"])).toEqual([
      { type: "p", text: "Intro :" },
      { type: "ul", items: ["un", "deux"] },
      { type: "p", text: "Suite." },
      { type: "ul", items: ["seul"] },
    ]);
  });

  it("ne prend pas un tiret de dialogue ou un nombre négatif pour une puce", () => {
    expect(bodyBlocks(["-12 % en un an", "— Et alors ?"])).toEqual([
      { type: "p", text: "-12 % en un an" }, { type: "p", text: "— Et alors ?" },
    ]);
  });

  it("pose les espaces insécables du français, et laisse l'anglais tel quel", () => {
    expect(typo("Pourquoi : « 95 % » ? Oui ; voilà !", "fr")).toBe("Pourquoi\u00a0: «\u00a095\u00a0%\u00a0»\u00a0? Oui\u00a0; voilà\u00a0!");
    expect(typo("Why: “95%”? Yes; there!", "en")).toBe("Why: “95%”? Yes; there!");
    expect(typo("marge de ± 3 points", "fr")).toBe("marge de ±\u00a03 points");
  });

  it("ne touche pas au tiret qui ouvre une puce", () => {
    expect(bodyBlocks([typo("- Exactitude : les points obtenus", "fr")])).toEqual([
      { type: "ul", items: ["Exactitude\u00a0: les points obtenus"] },
    ]);
  });
});
