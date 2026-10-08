import { describe, it, expect } from "vitest";
import { etapes, extrait, motifExclusion, ordre, reference, type QuestionFinqa } from "./finqa";

const q = (program: string, answer: string, exe: number): QuestionFinqa => ({
  id: "X/2020/page_1.pdf-1", pre_text: ["avant"], post_text: ["après"], table: [["", "2020"], ["ventes", "10"]],
  qa: { question: "?", answer, program, exe_ans: exe },
});
const TROIS = "subtract(318.46, const_100), divide(#0, const_100), subtract(#1, 0.5)";

describe("FinQA : ce qu'on garde", () => {
  it("compte les étapes du programme", () => {
    expect(etapes(q(TROIS, "1%", 0.01))).toBe(3);
  });
  it("garde un pourcentage écrit avec son signe, même si le programme rend la fraction", () => {
    expect(motifExclusion(q("add(1, 2), add(#0, 3), divide(#1, 50)", "12.0%", 0.12))).toBeNull();
  });
  it("écarte un calcul trop court", () => {
    expect(motifExclusion(q("divide(1, 2)", "50%", 0.5))).toMatch(/trois étapes/);
  });
  it("écarte un ratio sans signe % : on ne saurait pas à quelle échelle l'attendre", () => {
    expect(motifExclusion(q("add(1, 2), add(#0, 3), divide(#1, 50)", "0.12", 0.12))).toMatch(/échelle/);
  });
  it("écarte une réponse vide, et une réponse que le programme contredit", () => {
    expect(motifExclusion(q(TROIS, "", 1))).toMatch(/vide/);
    expect(motifExclusion(q(TROIS, "42", 7))).toMatch(/programme/);
  });
  it("retire l'unité de la référence sans toucher au nombre", () => {
    expect(reference(" 113.63% ")).toBe("113.63");
    expect(reference("$ 1,234.5")).toBe("1234.5");
    expect(reference("-4.1%")).toBe("-4.1");
  });
  it("range les questions dans un ordre qui ne dépend pas de celui du fichier", () => {
    expect(ordre(["a", "b", "c", "d"])).toEqual(ordre(["d", "c", "b", "a"]));
  });
  it("rend l'extrait avec son tableau, ligne à ligne", () => {
    expect(extrait(q(TROIS, "1%", 0.01))).toBe("avant\n\n | 2020\nventes | 10\n\naprès");
  });
});
