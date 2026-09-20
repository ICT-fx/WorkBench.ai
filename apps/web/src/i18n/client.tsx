"use client";

import { createContext, useContext } from "react";
import type { Dictionary, Locale } from ".";

type Value = { locale: Locale; dict: Dictionary };

const Ctx = createContext<Value | null>(null);

export function I18nProvider({ locale, dict, children }: Value & { children: React.ReactNode }) {
  return <Ctx.Provider value={{ locale, dict }}>{children}</Ctx.Provider>;
}

/** La langue et le dictionnaire de la page, pour les composants client. */
export function useI18n(): Value {
  const value = useContext(Ctx);
  if (value === null) throw new Error("useI18n appelé hors de I18nProvider");
  return value;
}
