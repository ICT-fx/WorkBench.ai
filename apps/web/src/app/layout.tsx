import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--police-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hub d'évaluations métier — quel modèle d'IA pour votre cas",
  description:
    "Le classement des modèles d'IA sur des tâches d'entreprise concrètes : " +
    "lire une facture française, répondre en SAV, résumer un contrat. " +
    "Protocole, documents et réponses brutes publiés.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={archivo.variable}>
      <body className="min-h-screen">
        <header className="border-b" style={{ borderColor: "var(--filet)" }}>
          <div className="mx-auto flex max-w-5xl flex-wrap items-baseline gap-x-8 gap-y-2 px-4 py-5 sm:px-8">
            <Link href="/" className="etendu text-lg font-semibold no-underline">
              Hub d&apos;évaluations métier
            </Link>
            <nav className="flex gap-6 text-sm" style={{ color: "var(--encre-pale)" }}>
              <Link href="/taches/facture-fr">Facture française</Link>
              <Link href="/methodologie">Méthodologie</Link>
            </nav>
          </div>
        </header>

        {children}

        <footer
          className="mt-24 border-t py-10 text-sm"
          style={{ borderColor: "var(--filet)", color: "var(--encre-pale)" }}
        >
          <div className="mx-auto max-w-5xl px-4 sm:px-8">
            <p className="max-w-[60ch]">
              Publié par Flowera. Les documents de test, les réponses brutes des modèles
              et le code de notation sont dans le dépôt public : chaque chiffre de ce site
              peut être recalculé.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
