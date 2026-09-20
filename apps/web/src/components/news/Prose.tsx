import type { Locale } from "@/i18n";
import { bodyBlocks, typo } from "@/lib/news";

/**
 * Un texte long du hub : paragraphes, et listes pour les suites de lignes « - ».
 * Composant serveur — `lib/news` lit le disque, il ne s'importe pas côté client.
 */
export function Prose({ body, locale, className = "" }: { body: string[]; locale: Locale; className?: string }) {
  return (
    <div className={`prose-hub ${className}`}>
      {bodyBlocks(body).map((block, i) =>
        block.type === "p" ? (
          <p key={i}>{typo(block.text, locale)}</p>
        ) : (
          <ul key={i}>
            {block.items.map((item) => <li key={item}>{typo(item, locale)}</li>)}
          </ul>
        ))}
    </div>
  );
}
