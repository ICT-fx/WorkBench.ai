"use client";

import { useState } from "react";
import type { LeaderboardRow } from "@hub/schema";
import { pourcent, euros, secondes } from "./Chiffre";

type Colonne = {
  id: keyof LeaderboardRow;
  titre: string;
  aide: string;
  /** Un score plus bas est-il meilleur ? */
  moinsEstMieux?: boolean;
  rendu: (r: LeaderboardRow) => string;
};

const COLONNES: Colonne[] = [
  {
    id: "sansRelecture", titre: "Factures sans relecture",
    aide: "Part des factures dont aucun champ critique n'est faux",
    rendu: (r) => pourcent(r.sansRelecture),
  },
  {
    id: "exactitude", titre: "Exactitude",
    aide: "Points obtenus sur l'ensemble des champs, pondérés par leur criticité",
    rendu: (r) => pourcent(r.exactitude),
  },
  {
    id: "hallucinations", titre: "Hallucinations",
    aide: "Champs inventés là où le document ne contient rien",
    moinsEstMieux: true,
    rendu: (r) => pourcent(r.hallucinations),
  },
  {
    id: "costPerDoc", titre: "Coût par facture",
    aide: "Moyenne des appels réussis, aux tarifs publics du jour du test",
    moinsEstMieux: true,
    rendu: (r) => euros(r.costPerDoc),
  },
  {
    id: "latencyP50", titre: "Temps médian",
    aide: "Médiane et non moyenne : un seul appel lent fausserait la moyenne",
    moinsEstMieux: true,
    rendu: (r) => secondes(r.latencyP50),
  },
];

export function Classement({ rows }: { rows: LeaderboardRow[] }) {
  // La spec : l'exactitude ordonne le classement, « sans relecture » est la
  // métrique mise en avant visuellement. Les deux rôles sont distincts.
  const [tri, setTri] = useState<keyof LeaderboardRow>("exactitude");

  const colonne = COLONNES.find((c) => c.id === tri)!;
  const triees = [...rows].sort((a, b) => {
    const [x, y] = [Number(a[tri]), Number(b[tri])];
    return colonne.moinsEstMieux ? x - y : y - x;
  });

  const filet = { borderColor: "var(--filet)" };

  return (
    <div>
      {/* Tableau réglé, à partir de la tablette */}
      <table className="hidden w-full border-collapse text-sm md:table">
        <thead>
          <tr className="border-b-2 text-left align-bottom" style={filet}>
            <th className="w-10 pb-3 pr-2 font-normal" style={{ color: "var(--encre-pale)" }}>
              <span className="sr-only">Rang</span>
            </th>
            <th className="pb-3 pr-6 font-semibold">Modèle</th>
            {COLONNES.map((c) => (
              <th
                key={c.id}
                className="pb-3 pl-5 text-right font-normal"
                style={c.id === "hallucinations"
                  ? { borderLeft: "1px solid var(--rouge)", ...filet }
                  : undefined}
              >
                <button
                  type="button"
                  onClick={() => { setTri(c.id); }}
                  title={c.aide}
                  aria-pressed={tri === c.id}
                  className="max-w-[9rem] cursor-pointer text-right leading-tight"
                  style={{
                    color: tri === c.id ? "var(--encre)" : "var(--encre-pale)",
                    fontWeight: tri === c.id ? 600 : 400,
                  }}
                >
                  {c.titre}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="chiffres">
          {triees.map((r, i) => (
            <tr key={r.model} className="border-b" style={filet}>
              <td className="py-3 pr-2 align-middle" style={{ color: "var(--encre-pale)" }}>
                {i + 1}
              </td>
              <td className="py-3 pr-6 align-middle">
                <span className="font-medium" style={{ fontVariantNumeric: "normal" }}>
                  {r.model}
                </span>
                <span className="block text-xs" style={{ color: "var(--encre-pale)" }}>
                  {r.modelVersion}
                  {r.errorCount > 0 && ` · ${r.errorCount} appel(s) en échec`}
                </span>
              </td>

              {COLONNES.map((c) => {
                const valeur = Number(r[c.id]);
                const rouge = c.id === "hallucinations" && valeur > 0;
                const dominante = c.id === "sansRelecture";
                return (
                  <td
                    key={c.id}
                    className="relative py-3 pl-5 text-right align-middle"
                    style={c.id === "hallucinations"
                      ? { borderLeft: "1px solid var(--rouge)" }
                      : undefined}
                  >
                    {dominante && (
                      <span
                        aria-hidden
                        className="absolute inset-y-2 right-0 -z-10 block"
                        style={{ width: `${valeur}%`, background: "var(--valide)", opacity: 0.11 }}
                      />
                    )}
                    <span
                      style={{
                        color: rouge ? "var(--rouge)" : dominante ? "var(--valide)" : undefined,
                        fontSize: dominante ? "1.15rem" : undefined,
                        fontWeight: dominante || rouge ? 600 : 400,
                      }}
                    >
                      {c.rendu(r)}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Sous tablette, le tableau se replie en fiches empilées */}
      <ul className="space-y-6 md:hidden">
        {triees.map((r, i) => (
          <li key={r.model} className="border-b pb-5" style={filet}>
            <p className="font-medium">
              <span style={{ color: "var(--encre-pale)" }}>{i + 1}. </span>
              {r.model}
            </p>
            <p className="mb-3 text-xs" style={{ color: "var(--encre-pale)" }}>{r.modelVersion}</p>
            <dl className="chiffres space-y-1 text-sm">
              {COLONNES.map((c) => {
                const rouge = c.id === "hallucinations" && Number(r[c.id]) > 0;
                return (
                  <div key={c.id} className="flex justify-between gap-4">
                    <dt style={{ color: "var(--encre-pale)" }}>{c.titre}</dt>
                    <dd style={{ color: rouge ? "var(--rouge)" : undefined, fontWeight: rouge ? 600 : 400 }}>
                      {c.rendu(r)}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs md:hidden" style={{ color: "var(--encre-pale)" }}>
        Classé par exactitude.
      </p>
    </div>
  );
}
