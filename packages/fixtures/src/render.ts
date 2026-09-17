import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import type { Invoice } from "./invoice-model.js";
import type { TemplateId } from "./scenarios.js";

const W = 1240;
const M = 80;

type Style = {
  font: string;
  accent: string;
  band: boolean;
  grid: boolean;
  dateFmt: "slash" | "long";
};

const STYLES: Record<TemplateId, Style> = {
  sobre: { font: "Helvetica Neue, Helvetica, Arial", accent: "#111111", band: false, grid: false, dateFmt: "slash" },
  tableau: { font: "Arial, Helvetica", accent: "#1a1a1a", band: false, grid: true, dateFmt: "slash" },
  colore: { font: "Georgia, Times New Roman, serif", accent: "#1b4965", band: true, grid: false, dateFmt: "long" },
};

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function fmtDate(iso: string, fmt: Style["dateFmt"]): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return fmt === "slash"
    ? `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`
    : `${d} ${MOIS[m - 1]} ${y}`;
}

function fmtMoney(n: number, currency: Invoice["currency"]): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(n);
}

/** Découpe un texte trop large pour la colonne. */
function wrap(ctx: SKRSContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

type Page = { lines: Invoice["lines"]; first: boolean; last: boolean; index: number; total: number };

function drawPage(inv: Invoice, s: Style, page: Page): Buffer {
  const rowH = 34;
  const headerH = page.first ? 300 : 150;
  const totalsH = page.last ? 260 : 60;
  const H = headerH + 60 + page.lines.length * rowH + totalsH + 120;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";

  let y = M;

  if (page.first) {
    if (s.band) {
      ctx.fillStyle = s.accent;
      ctx.fillRect(0, 0, W, 130);
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold 30px ${s.font}`;
      ctx.fillText(inv.emetteur.nom, M, 62);
      ctx.font = `16px ${s.font}`;
      ctx.fillText(inv.emetteur.adresse, M, 92);
      y = 190;
    } else {
      ctx.fillStyle = s.accent;
      ctx.font = `bold 26px ${s.font}`;
      ctx.fillText(inv.emetteur.nom, M, y);
      ctx.font = `15px ${s.font}`;
      ctx.fillStyle = "#333333";
      ctx.fillText(inv.emetteur.adresse, M, y + 26);
      y += 80;
    }

    // Titre et références, alignés à droite
    ctx.fillStyle = s.accent;
    ctx.font = `bold 34px ${s.font}`;
    const titre = inv.isCreditNote ? "AVOIR" : "FACTURE";
    ctx.fillText(titre, W - M - ctx.measureText(titre).width, page.first && s.band ? 190 : y - 40);

    ctx.fillStyle = "#222222";
    ctx.font = `16px ${s.font}`;
    const refs = [
      `N° ${inv.numero}`,
      `Date : ${fmtDate(inv.dateEmission, s.dateFmt)}`,
      ...(inv.echeance ? [`Échéance : ${fmtDate(inv.echeance, s.dateFmt)}`] : []),
    ];
    let ry = (s.band ? 220 : y - 10);
    for (const r of refs) {
      ctx.fillText(r, W - M - ctx.measureText(r).width, ry);
      ry += 24;
    }

    // Bloc client
    ctx.fillStyle = "#666666";
    ctx.font = `13px ${s.font}`;
    ctx.fillText("FACTURÉ À", M, y + 10);
    ctx.fillStyle = "#111111";
    ctx.font = `bold 17px ${s.font}`;
    ctx.fillText(inv.client.nom, M, y + 36);
    ctx.font = `15px ${s.font}`;
    ctx.fillStyle = "#333333";
    ctx.fillText(inv.client.adresse, M, y + 60);
    y = Math.max(y + 110, ry + 30);
  } else {
    ctx.fillStyle = "#666666";
    ctx.font = `15px ${s.font}`;
    ctx.fillText(`${inv.numero} — page ${page.index + 1}/${page.total} (suite)`, M, y);
    y += 60;
  }

  // En-tête du tableau
  const cols = { des: M, qte: 700, pu: 810, tva: 960, mt: W - M };
  ctx.fillStyle = "#666666";
  ctx.font = `bold 13px ${s.font}`;
  ctx.fillText("DÉSIGNATION", cols.des, y);
  ctx.fillText("QTÉ", cols.qte, y);
  ctx.fillText("P.U. HT", cols.pu, y);
  ctx.fillText("TVA", cols.tva, y);
  const mtLabel = "MONTANT HT";
  ctx.fillText(mtLabel, cols.mt - ctx.measureText(mtLabel).width, y);
  y += 12;
  ctx.strokeStyle = s.grid ? "#999999" : "#dddddd";
  ctx.lineWidth = s.grid ? 1.5 : 1;
  ctx.beginPath();
  ctx.moveTo(M, y);
  ctx.lineTo(W - M, y);
  ctx.stroke();
  y += 26;

  // Lignes
  ctx.font = `15px ${s.font}`;
  for (const line of page.lines) {
    ctx.fillStyle = "#111111";
    const wrapped = wrap(ctx, line.designation, cols.qte - cols.des - 30);
    ctx.fillText(wrapped[0]!, cols.des, y);
    ctx.fillText(String(line.quantite), cols.qte, y);
    ctx.fillText(fmtMoney(line.prixUnitaireHT, inv.currency), cols.pu, y);
    ctx.fillText(line.tauxTVA === null ? "—" : `${line.tauxTVA} %`, cols.tva, y);
    const mt = fmtMoney(line.montantHT, inv.currency);
    ctx.fillText(mt, cols.mt - ctx.measureText(mt).width, y);
    if (wrapped.length > 1) {
      ctx.fillStyle = "#555555";
      ctx.font = `13px ${s.font}`;
      ctx.fillText(wrapped.slice(1).join(" "), cols.des, y + 18);
      ctx.font = `15px ${s.font}`;
    }
    y += rowH;
    if (s.grid) {
      ctx.strokeStyle = "#dddddd";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(M, y - 20);
      ctx.lineTo(W - M, y - 20);
      ctx.stroke();
    }
  }

  if (!page.last) {
    ctx.fillStyle = "#666666";
    ctx.font = `italic 14px ${s.font}`;
    ctx.fillText("Suite page suivante…", W - M - 160, y + 20);
    return canvas.toBuffer("image/png");
  }

  // Totaux
  y += 24;
  const right = W - M;
  const labelX = right - 320;
  const drawTotal = (label: string, value: string, bold = false) => {
    ctx.fillStyle = bold ? s.accent : "#333333";
    ctx.font = `${bold ? "bold " : ""}${bold ? 20 : 16}px ${s.font}`;
    ctx.fillText(label, labelX, y);
    ctx.fillText(value, right - ctx.measureText(value).width, y);
    y += bold ? 36 : 28;
  };

  if (inv.globalDiscountPct !== null) {
    const brut = inv.lines.reduce((a, l) => a + l.montantHT / (1 - inv.globalDiscountPct! / 100), 0);
    drawTotal("Sous-total HT", fmtMoney(Math.round(brut * 100) / 100, inv.currency));
    drawTotal(`Remise ${inv.globalDiscountPct} %`, fmtMoney(inv.totalHT - Math.round(brut * 100) / 100, inv.currency));
  }
  drawTotal("Total HT", fmtMoney(inv.totalHT, inv.currency));

  if (inv.totalTVA === null) {
    ctx.fillStyle = "#333333";
    ctx.font = `16px ${s.font}`;
    ctx.fillText("TVA", labelX, y);
    ctx.fillText("—", right - ctx.measureText("—").width, y);
    y += 28;
  } else {
    const byRate = new Map<number, number>();
    for (const line of inv.lines) {
      const r = line.tauxTVA ?? 0;
      byRate.set(r, Math.round(((byRate.get(r) ?? 0) + line.montantHT * (r / 100)) * 100) / 100);
    }
    for (const [rate, amount] of [...byRate].sort((a, b) => a[0] - b[0])) {
      drawTotal(`TVA ${rate} %`, fmtMoney(amount, inv.currency));
    }
  }
  drawTotal("TOTAL TTC", fmtMoney(inv.totalTTC, inv.currency), true);
  if (inv.netAPayer !== null) {
    drawTotal("Net à payer", fmtMoney(inv.netAPayer, inv.currency), true);
  }

  // Pied de page
  y += 30;
  ctx.strokeStyle = "#dddddd";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(M, y);
  ctx.lineTo(W - M, y);
  ctx.stroke();
  y += 28;
  ctx.fillStyle = "#555555";
  ctx.font = `14px ${s.font}`;
  const footer = [
    `SIRET ${inv.emetteur.siret.replace(/(\d{3})(\d{3})(\d{3})(\d{5})/, "$1 $2 $3 $4")}`,
    ...(inv.emetteur.tvaIntracom ? [`TVA intracommunautaire : ${inv.emetteur.tvaIntracom}`] : []),
    ...inv.mentions,
  ];
  for (const f of footer) {
    ctx.fillText(f, M, y);
    y += 22;
  }

  return canvas.toBuffer("image/png");
}

/** Rend une facture. Renvoie une image par page. */
export function renderInvoice(inv: Invoice, template: TemplateId, twoPages = false): Buffer[] {
  const s = STYLES[template];
  if (!twoPages) {
    return [drawPage(inv, s, { lines: inv.lines, first: true, last: true, index: 0, total: 1 })];
  }
  const cut = Math.ceil(inv.lines.length / 2);
  return [
    drawPage(inv, s, { lines: inv.lines.slice(0, cut), first: true, last: false, index: 0, total: 2 }),
    drawPage(inv, s, { lines: inv.lines.slice(cut), first: false, last: true, index: 1, total: 2 }),
  ];
}
