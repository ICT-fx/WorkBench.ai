/**
 * Un lecteur CSV minimal, conforme aux guillemets.
 *
 * Écrit ici plutôt qu'emprunté à une bibliothèque : le seul besoin du projet est
 * de relire un manifeste de jeu de test, et une dépendance de plus se mettrait
 * entre le lecteur du dépôt et la vérification des chiffres. Il vit dans le
 * paquet partagé parce que la préparation des données et le site le lisent tous
 * les deux, et que le site ne doit pas dépendre de l'outillage de préparation.
 */
/** Lecteur CSV minimal, suffisant pour ce fichier : guillemets et virgules. */
export function parseCsv(texte: string): Record<string, string>[] {
  const lignes: string[][] = [];
  let champ = "", ligne: string[] = [], dansGuillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i]!;
    if (dansGuillemets) {
      if (c === '"' && texte[i + 1] === '"') { champ += '"'; i++; }
      else if (c === '"') dansGuillemets = false;
      else champ += c;
    } else if (c === '"') dansGuillemets = true;
    else if (c === ",") { ligne.push(champ); champ = ""; }
    else if (c === "\n") { ligne.push(champ); lignes.push(ligne); ligne = []; champ = ""; }
    else if (c !== "\r") champ += c;
  }
  if (champ !== "" || ligne.length > 0) { ligne.push(champ); lignes.push(ligne); }
  const [entetes, ...corps] = lignes;
  return corps
    .filter((l) => l.length === entetes!.length)
    .map((l) => Object.fromEntries(entetes!.map((h, i) => [h.trim(), (l[i] ?? "").trim()])));
}
