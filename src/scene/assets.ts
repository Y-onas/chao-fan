const base = `${import.meta.env.BASE_URL}assets/food/`;

/** Photo-derived food textures cut from the restaurant's reference photos (see ASSETS.md). */
export const ASSET = {
  riceAlbedo: `${base}rice-albedo.webp`,
  riceNormal: `${base}rice-normal.webp`,
  riceRoughness: `${base}rice-roughness.webp`,
  chickenLeg: `${base}chicken-leg.webp`,
  chickenLegH: `${base}chicken-leg_h.webp`,
  friedEgg: `${base}fried-egg.webp`,
  friedEggH: `${base}fried-egg_h.webp`,
  sauce: `${base}house-sauce.webp`,
  sauceH: `${base}house-sauce_h.webp`,
  chickenPieces: [1, 2, 3].map((i) => [`${base}chicken-piece-${i}.webp`, `${base}chicken-piece-${i}_h.webp`] as const),
} as const;
