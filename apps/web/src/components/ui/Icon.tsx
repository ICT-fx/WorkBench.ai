/**
 * Le jeu d'icônes du hub : tracé unique de 1,5 px sur une grille de 20, bouts
 * et angles arrondis. Dessinées ici plutôt qu'importées — une trentaine de
 * pictogrammes ne justifient pas une dépendance, et le trait reste le nôtre.
 */
const PATHS = {
  // Métiers
  indice: "M10 3 3 6.5 10 10l7-3.5zM3 10l7 3.5 7-3.5M3 13.5 10 17l7-3.5",
  finance: "M3 16.5h14M4 13l4-4 3 3 5-6M13 6h3v3",
  comptabilite: "M5 3h10v14l-2.5-1.5L10 17l-2.5-1.5L5 17zM8 7h4M8 10.5h4",
  rh: "M7.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM3 16.5c0-2.5 2-4.5 4.5-4.5s4.500 2 4.500 4.500M13 9.200a2.300 2.300 0 1 0-.7-4.400M14.200 12c1.700.500 2.800 2.200 2.800 4.500",
  juridique: "M10 3v14M6.500 17h7M4.500 6h11M4.500 6l-2 5.500h4zM15.500 6l-2 5.500h4z",
  commercial: "M3 7h14v9.500H3zM7.500 7V4.500h5V7M3 11.500h14",
  marketing: "M3 8v4l2.200.600.900 3.400h2l-.700-2.900L15 15V5L5.200 8zM17 8.500v3",
  "service-client": "M4 4h12v9.500H9.500L5.500 16.500v-3H4zM7.500 8.700h5",
  achats: "M3 6.500 10 3l7 3.500v7L10 17l-7-3.500zM3 6.500 10 10l7-3.500M10 10v7",
  informatique: "M3 4h14v12H3zM6 8l2.500 2L6 12M10.500 12.500H14",
  direction: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM12.800 7.200l-1.600 4-4 1.600 1.600-4z",
  // Interface
  "arrow-right": "M4 10h12M11 5l5 5-5 5",
  "arrow-up-right": "M6 14l8-8M7.500 6H14v6.500",
  "chevron-down": "M5 8l5 5 5-5",
  "chevron-left": "M12.500 5l-5 5 5 5",
  "chevron-right": "M7.500 5l5 5-5 5",
  search: "M9 15A6 6 0 1 0 9 3a6 6 0 0 0 0 12zM13.500 13.500 17 17",
  close: "M5 5l10 10M15 5 5 15",
  check: "M4 10.500l4 4 8-8.500",
  menu: "M3 6h14M3 10h14M3 14h14",
  globe: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM3 10h14M10 3c2 2 3 4.500 3 7s-1 5-3 7c-2-2-3-4.500-3-7s1-5 3-7z",
  swap: "M4 7h11M12 4l3 3-3 3M16 13H5M8 10l-3 3 3 3",
  clock: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM10 6v4l2.500 2",
  coin: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM12.200 7.900c-.400-.700-1.200-1.100-2.200-1.100-1.300 0-2.100.600-2.100 1.500 0 2.200 4.300 1.100 4.300 3.300 0 .900-.900 1.600-2.200 1.600-1.100 0-1.900-.400-2.300-1.200M10 5.400v1.400M10 13.200v1.400",
  target: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  info: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM10 9.200v4.300M10 6.500v.200",
  bars: "M4 16V9M8 16V5M12 16v-5M16 16V7",
  document: "M5 3h7l3 3v11H5zM12 3v3h3M7.500 10h5M7.500 13h5",
  text: "M4 5.500h12M4 10h12M4 14.500h8",
  download: "M10 3v10M6 9l4 4 4-4M4 16.500h12",
  warning: "M10 3.500 17.500 16h-15zM10 8.200v3.800M10 14v.200",
  "lock-open": "M5 9h10v8H5zM7 9V6.500a3 3 0 0 1 5.800-1",
  lock: "M5 9h10v8H5zM7 9V6.500a3 3 0 0 1 6 0V9",
  image: "M3 4h14v12H3zM3 13.500l4-4 3 3 2.500-2.500L17 14.500M13 7.400v.200",
  video: "M3 5h10v10H3zM13 8.500 17 6v8l-4-2.500",
  audio: "M4 8v4M7 6v8M10 4v12M13 7v6M16 9v2",
  spark: "M10 3v3M10 14v3M3 10h3M14 10h3M5.200 5.200l2 2M12.800 12.800l2 2M14.800 5.200l-2 2M7.200 12.800l-2 2",
  calendar: "M4 5h12v11.500H4zM4 8.500h12M7 3v3M13 3v3",
  plus: "M10 4v12M4 10h12",
  link: "M8.500 11.500a3 3 0 0 0 4.200 0l2.800-2.800a3 3 0 0 0-4.200-4.200l-1 1M11.500 8.500a3 3 0 0 0-4.200 0l-2.800 2.800a3 3 0 0 0 4.200 4.200l1-1",
  flask: "M8 3h4M8.500 3v5L4 16.500h12L11.500 8V3M6.500 12.500h7",
} as const;

export type IconName = keyof typeof PATHS;

export const hasIcon = (name: string): name is IconName => name in PATHS;

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ flex: "none" }}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
