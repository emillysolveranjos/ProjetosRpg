// Arte própria para a prévia do mapa (sem imagens de terceiros): tokens redondos com moldura,
// no estilo comum de VTT, e fundos de mapa claros e escuros para testar contraste.

export type TokenArt = "guerreira" | "goblin" | "dragao" | "maga" | "urso" | "esqueleto";
export type MapArt = "madeira" | "masmorra" | "floresta" | "neve";

const RING = `<circle cx="128" cy="128" r="120" fill="none" stroke="#c9a95c" stroke-width="12"/><circle cx="128" cy="128" r="113" fill="none" stroke="#5b4320" stroke-width="3"/>`;
const bust = (skin: string, cloth: string) => `<path d="M40 236c8-52 44-78 88-78s80 26 88 78z" fill="${cloth}"/><circle cx="128" cy="104" r="44" fill="${skin}"/>`;
const eyes = (color: string, y = 100, spread = 16) => `<circle cx="${128 - spread}" cy="${y}" r="6" fill="${color}"/><circle cx="${128 + spread}" cy="${y}" r="6" fill="${color}"/>`;

const BODIES: Record<TokenArt, string> = {
  guerreira: `<rect width="256" height="256" fill="#3b5b8f"/><path d="M0 0h256v256z" fill="#466ca6" opacity=".5"/>${bust("#e8b996", "#8a96a8")}<path d="M84 98c0-34 20-54 44-54s44 20 44 54v-8H84z" fill="#b8c2cf"/><rect x="122" y="44" width="12" height="40" fill="#8a96a8"/>${eyes("#1d2733")}<path d="M196 60l20 150" stroke="#e6e9ef" stroke-width="8"/>`,
  goblin: `<rect width="256" height="256" fill="#4e6b2f"/><circle cx="60" cy="60" r="30" fill="#5d7e38"/><circle cx="200" cy="190" r="40" fill="#5d7e38"/>${bust("#7fae4a", "#6b4a2b")}<path d="M86 96L40 70l40 42zM170 96l46-26-40 42z" fill="#7fae4a"/>${eyes("#ffd23f", 98, 18)}<path d="M108 128q20 12 40 0" stroke="#2c3b16" stroke-width="5" fill="none"/>`,
  dragao: `<rect width="256" height="256" fill="#6d1f1a"/><path d="M0 256L70 120l58 70 58-70 70 136z" fill="#8c2a22"/><path d="M128 40c40 0 70 30 70 76 0 50-30 90-70 90s-70-40-70-90c0-46 30-76 70-76z" fill="#c2412f"/><path d="M84 70L60 22l44 34zM172 70l24-48-44 34z" fill="#e9d8a6"/>${eyes("#ffcc33", 106, 26)}<path d="M100 160h56" stroke="#3a0d0a" stroke-width="6"/>`,
  maga: `<rect width="256" height="256" fill="#3d2a6b"/><circle cx="50" cy="70" r="4" fill="#fff"/><circle cx="210" cy="50" r="3" fill="#fff"/><circle cx="200" cy="200" r="4" fill="#fff"/>${bust("#f1c9a5", "#5b3fa0")}<path d="M76 92L128 8l52 84z" fill="#6c4bc4"/><path d="M70 92h116" stroke="#2a1b52" stroke-width="10"/>${eyes("#2a1b52", 110)}`,
  urso: `<rect width="256" height="256" fill="#6b4a2b"/><circle cx="128" cy="140" r="90" fill="#8a6239"/><circle cx="72" cy="66" r="24" fill="#8a6239"/><circle cx="184" cy="66" r="24" fill="#8a6239"/><circle cx="100" cy="116" r="26" fill="#f2e6c9"/><circle cx="156" cy="116" r="26" fill="#f2e6c9"/>${eyes("#1a1206", 116, 28)}<path d="M112 140h32l-16 30z" fill="#e0a21b"/>`,
  esqueleto: `<rect width="256" height="256" fill="#d8d3c4"/><path d="M0 200h256v56H0z" fill="#bdb6a3"/>${bust("#f4f1e8", "#9c9583")}<circle cx="110" cy="102" r="12" fill="#2b2924"/><circle cx="146" cy="102" r="12" fill="#2b2924"/><path d="M112 132h32M118 132v10M128 132v10M138 132v10" stroke="#2b2924" stroke-width="4"/>`,
};

export function tokenImage(art: TokenArt): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><defs><clipPath id="c"><circle cx="128" cy="128" r="118"/></clipPath></defs><g clip-path="url(#c)">${BODIES[art]}</g>${RING}</svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

/** Definições de padrão SVG para cada fundo de mapa. */
export const MAP_PATTERNS: Record<MapArt, string> = {
  madeira: `<pattern id="map-madeira" width="150" height="60" patternUnits="userSpaceOnUse"><rect width="150" height="60" fill="#8b6239"/><rect y="0" width="150" height="29" fill="#9a6d40"/><path d="M0 29.5h150M0 59.5h150M60 0v29M120 30v30" stroke="#5e3f22" stroke-width="2"/><path d="M10 12q30 6 60 0M80 44q30-6 60 0" stroke="#7a5430" stroke-width="2" fill="none"/></pattern>`,
  masmorra: `<pattern id="map-masmorra" width="75" height="75" patternUnits="userSpaceOnUse"><rect width="75" height="75" fill="#3a3d42"/><rect x="3" y="3" width="69" height="69" rx="6" fill="#4a4e55"/><circle cx="22" cy="30" r="5" fill="#40444a"/><circle cx="52" cy="50" r="3" fill="#40444a"/></pattern>`,
  floresta: `<pattern id="map-floresta" width="90" height="90" patternUnits="userSpaceOnUse"><rect width="90" height="90" fill="#4f7a3a"/><circle cx="15" cy="20" r="6" fill="#5e8c45"/><circle cx="60" cy="35" r="9" fill="#456c32"/><circle cx="35" cy="70" r="7" fill="#6b9a50"/><path d="M75 75l4-10 4 10" stroke="#3b5e2b" stroke-width="2" fill="none"/></pattern>`,
  neve: `<pattern id="map-neve" width="80" height="80" patternUnits="userSpaceOnUse"><rect width="80" height="80" fill="#eef3f7"/><circle cx="20" cy="25" r="10" fill="#e1e9f0"/><circle cx="60" cy="60" r="14" fill="#e6edf3"/><circle cx="55" cy="15" r="3" fill="#cfdbe5"/></pattern>`,
};
