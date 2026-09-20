import type { Dictionary } from "@/i18n";

/**
 * Un classement de démonstration ne doit jamais pouvoir passer pour une mesure,
 * y compris sur une capture d'écran sortie de son contexte : la marque voyage
 * avec chaque tableau et chaque graphique, pas seulement avec la page.
 */
export function DemoTag({ dict, show = true }: { dict: Dictionary; show?: boolean }) {
  if (!show) return null;
  return (
    <span className="pastille pastille-demo" title={dict.common.demo.chartNote}>
      {dict.common.demo.tag}
    </span>
  );
}
