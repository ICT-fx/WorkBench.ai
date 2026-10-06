/**
 * Le site de l'éditeur, en un seul endroit.
 *
 * Le hub et le site de Flowera se répondent : chacun porte un lien vers
 * l'autre. Une adresse qui change ne doit pas se chercher dans six fichiers.
 * `flowera.fr` existe et redirige vers `.ch` ; on vise la destination finale
 * pour éviter un saut de redirection à chaque visiteur.
 */
export const EDITEUR = {
  nom: "Flowera",
  hote: "flowera.ch",
  url: "https://flowera.ch",
} as const;
