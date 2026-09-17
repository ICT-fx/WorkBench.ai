import sharp from "sharp";

/**
 * Imite un document scanné de travers ou photographié : rotation, perte de
 * contraste, bruit, et compression JPEG. Sans cette dégradation, le jeu de test
 * ne mesurerait que la lecture de documents parfaits, ce qui n'est pas le cas
 * d'usage réel — une PME reçoit des scans, pas des PDF propres.
 */
export async function degrade(png: Buffer, seed: number): Promise<Buffer> {
  const angle = 1.2 + (seed % 100) / 55; // 1,2° à 3,0°
  return sharp(png)
    .rotate(angle, { background: { r: 246, g: 244, b: 238 } })
    .modulate({ brightness: 0.97, saturation: 0.9 })
    .linear(0.92, 12) // contraste réduit, fond légèrement gris
    .blur(0.4)
    .jpeg({ quality: 68 })
    .toBuffer()
    .then((jpg) => sharp(jpg).png().toBuffer());
}
