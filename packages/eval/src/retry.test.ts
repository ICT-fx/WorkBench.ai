import { describe, it, expect, vi } from "vitest";
import { estPassager, delai, reessayer, HttpError } from "./retry";

describe("erreurs passagères", () => {
  it("reconnaît les refus temporaires rencontrés lors du premier run", () => {
    expect(estPassager(new HttpError(402, "crédit réservé par les appels en cours"))).toBe(true);
    expect(estPassager(new HttpError(429, "quota par minute"))).toBe(true);
    expect(estPassager(new HttpError(503, "no healthy upstream"))).toBe(true);
    expect(estPassager(new Error("A Timeout Occurred"))).toBe(true);
  });

  it("ne réessaie pas ce qui ne changera pas tout seul", () => {
    expect(estPassager(new HttpError(403, "confirmation d'âge requise"))).toBe(false);
    expect(estPassager(new HttpError(400, "requête malformée"))).toBe(false);
    expect(estPassager(new Error("réponse sans JSON exploitable"))).toBe(false);
  });
});

describe("attente", () => {
  it("croît d'une tentative à l'autre", () => {
    const t0 = delai(0, 1000), t3 = delai(3, 1000);
    expect(t3).toBeGreaterThan(t0);
  });
  it("reste sous le plafond", () => {
    expect(delai(20, 1000, 60000)).toBeLessThanOrEqual(60000 * 1.25);
  });
});

describe("reessayer", () => {
  const sansAttendre = { dormir: async () => {} };

  it("rend le résultat dès qu'un appel aboutit", async () => {
    let n = 0;
    const r = await reessayer(async () => {
      n++;
      if (n < 3) throw new HttpError(429, "quota");
      return "ok";
    }, sansAttendre);
    expect(r).toBe("ok");
    expect(n).toBe(3);
  });

  it("abandonne immédiatement sur une erreur définitive", async () => {
    const action = vi.fn(async () => { throw new HttpError(403, "âge non confirmé"); });
    await expect(reessayer(action, sansAttendre)).rejects.toThrow(/âge/);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("abandonne après le nombre de tentatives prévu", async () => {
    const action = vi.fn(async () => { throw new HttpError(503, "indisponible"); });
    await expect(reessayer(action, { ...sansAttendre, tentatives: 4 })).rejects.toThrow();
    expect(action).toHaveBeenCalledTimes(4);
  });

  it("respecte le délai imposé par le serveur", async () => {
    const attentes: number[] = [];
    let n = 0;
    await reessayer(async () => {
      if (n++ === 0) throw new HttpError(429, "quota", 4200);
      return "ok";
    }, { dormir: async (ms) => { attentes.push(ms); } });
    expect(attentes).toEqual([4200]);
  });
});

describe("refus de crédit", () => {
  it("réessaie quand ce sont les appels en cours qui réservent le crédit", () => {
    expect(estPassager(new HttpError(402,
      'would exceed your available credits given your current in-flight requests'))).toBe(true);
  });

  it("abandonne quand le crédit est réellement épuisé : attendre n'y changera rien", () => {
    expect(estPassager(new HttpError(402,
      '{"reason":"weight_exceeds_budget"} maximum cost exceeds your available credits'))).toBe(false);
  });
});
