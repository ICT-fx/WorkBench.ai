/**
 * Un classement de démonstration ne doit jamais pouvoir passer pour une mesure,
 * y compris sur une capture d'écran sortie de son contexte.
 */
export function BandeauDemo() {
  return (
    <div
      className="border-y px-4 py-4 sm:px-8"
      style={{ borderColor: "var(--rouge)", background: "var(--papier-creux)" }}
    >
      <div className="mx-auto max-w-5xl">
        <p className="max-w-[70ch] text-sm" style={{ color: "var(--rouge)" }}>
          <strong className="font-semibold">Chiffres de démonstration.</strong>{" "}
          Aucun modèle réel n&apos;a été interrogé : ces réponses sont fabriquées pour
          construire le site. Les noms de modèles sont fictifs. Le premier classement
          mesuré remplacera cette page.
        </p>
      </div>
    </div>
  );
}
