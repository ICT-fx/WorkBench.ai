import { describe, expect, it } from "vitest";
import { linear, log, logTicks, niceTicks, percentDomain } from "./scales";

describe("échelles des graphiques", () => {
  it("projette une valeur entre deux bornes", () => {
    expect(linear(0, 100, 0, 500)(50)).toBe(250);
    expect(log(0.01, 1, 0, 200)(0.1)).toBeCloseTo(100);
  });

  it("centre la valeur quand le domaine est réduit à un point, au lieu de diviser par zéro", () => {
    expect(linear(5, 5, 0, 100)(5)).toBe(50);
  });

  it("propose des graduations rondes", () => {
    expect(niceTicks(40, 100)).toEqual([40, 60, 80, 100]);
    expect(niceTicks(0, 0.3, 3)).toEqual([0, 0.1, 0.2, 0.3]);
  });

  it("gradue une échelle logarithmique en 1-2-5", () => {
    expect(logTicks(0.01, 0.5)).toEqual([0.01, 0.02, 0.05, 0.1, 0.2, 0.5]);
  });

  it("garde un axe de pourcentages entre 0 et 100", () => {
    expect(percentDomain([52.3, 97.1])).toEqual([40, 100]);
    expect(percentDomain([3, 40])).toEqual([0, 50]);
  });
});
