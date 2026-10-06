/**
 * L'adresse publique du site, pour les liens absolus des métadonnées.
 *
 * Sans elle, Next construit les URL canoniques et les aperçus de partage à
 * partir de `localhost` : un lien partagé sur LinkedIn mènerait chez personne.
 * L'ordre va du plus explicite au plus automatique — `NEXT_PUBLIC_SITE_URL`
 * quand le domaine définitif est en place, l'adresse de production donnée par
 * Vercel sinon, et le serveur local en dernier recours.
 */
export function siteUrl(): URL {
  const explicite = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicite !== undefined && explicite !== "") return new URL(explicite);

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel !== undefined && vercel !== "") return new URL(`https://${vercel}`);

  return new URL(`http://localhost:${process.env.PORT ?? "3000"}`);
}
