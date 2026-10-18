import type { Marker } from "../domain/types";
import type { Scenario, ScenarioGroup, TokenSpec } from "./layout";

// Cenários da prévia do mapa. Cada grupo vira uma captura em `npm run preview:map`.
const ca = (value = 15, extra: Partial<Marker> = {}): Partial<Marker> => ({ name: "Classe de Armadura", mapLabel: "CA", value, color: "#2f7d6d", ...extra });
const one = (title: string, token: Omit<TokenSpec, "at">, extra: Partial<Scenario> = {}): Scenario => ({ title, cells: [3, 3], tokens: [{ at: [1, 1], ...token }], ...extra });

export const GROUPS: ScenarioGroup[] = [
  {
    id: "hp", title: "Barra de HP", map: "madeira", description: "Valores normais, extremos, sobrevida e cor personalizada.",
    scenarios: [
      one("Cheia 48/48", { art: "guerreira", hp: [48, 48] }),
      one("Metade 24/48", { art: "guerreira", hp: [24, 48] }),
      one("Baixa 6/48", { art: "guerreira", hp: [6, 48] }),
      one("Zero 0/48", { art: "guerreira", hp: [0, 48] }),
      one("Negativa −7/48", { art: "guerreira", hp: [-7, 48] }),
      one("Sobrevida 58/48", { art: "guerreira", hp: [58, 48] }),
      one("Números grandes", { art: "dragao", hp: [12345, 99999] }),
      one("Cor escolhida pelo mestre", { art: "maga", hp: [30, 40], hpMarker: { color: "#8e44ad" } }),
    ],
  },
  {
    id: "tipos", title: "Tipos de marcador", map: "madeira", description: "Número, contador, marcação, barra extra, siglas e o máximo de 12 marcadores.",
    scenarios: [
      one("Número sem sigla", { art: "goblin", markers: [{ name: "CA", value: 15 }] }),
      one("Número com sigla", { art: "goblin", markers: [ca()] }),
      one("Contador", { art: "goblin", markers: [{ name: "Munição", mapLabel: "MUN", kind: "counter", value: 12, color: "#b7791f" }] }),
      one("Marcação marcada e desmarcada", { art: "goblin", markers: [{ name: "Concentrado", mapLabel: "CONC", kind: "checkbox", checked: true, color: "#c05621" }, { name: "Reação", kind: "checkbox", checked: false, color: "#4a5568" }] }),
      one("Barra extra com sigla", { art: "maga", markers: [{ name: "Mana", mapLabel: "PM", kind: "bar", value: 5, maximum: 12, color: "#4c51bf" }] }),
      one("Valor longo", { art: "maga", markers: [{ name: "Ouro", value: -12345, color: "#b7791f" }] }),
      one("CA + DEF + PM + CONC", { art: "urso", markers: [ca(), { name: "Defesa", mapLabel: "DEF", value: 12, color: "#2b6cb0" }, { name: "Mana", mapLabel: "PM", kind: "counter", value: 7, color: "#4c51bf" }, { name: "Concentrado", mapLabel: "CONC", kind: "checkbox", checked: true, color: "#c05621" }] }),
      one("12 marcadores (máximo)", { art: "urso", markers: [{ name: "Mana", kind: "bar", value: 3, maximum: 10, color: "#4c51bf" }, ...Array.from({ length: 10 }, (_, i) => ({ name: "R" + i, value: i * 3, color: i % 2 ? "#2b6cb0" : "#2f7d6d" }))] }),
    ],
  },
  {
    id: "layout", title: "Posição, alinhamento e tamanho", map: "madeira", description: "Preferências de cada participante na engrenagem e por token.",
    scenarios: [
      ...(["TOP", "BOTTOM"] as const).flatMap((position) => (["LEFT", "CENTER", "RIGHT"] as const).map((horizontal) => one(`${position === "TOP" ? "Acima" : "Abaixo"} · ${{ LEFT: "esquerda", CENTER: "centro", RIGHT: "direita" }[horizontal]}`, { art: "guerreira", layout: { position, horizontal }, markers: [ca()] }))),
      ...(["LEFT", "RIGHT"] as const).map((horizontal) => one(`Pequeno · ${horizontal === "LEFT" ? "esquerda" : "direita"}`, { art: "guerreira", layout: { size: "SMALL", horizontal }, markers: [ca()] })),
      one("Tamanho pequeno", { art: "guerreira", layout: { size: "SMALL" }, markers: [ca(), { name: "Defesa", mapLabel: "DEF", value: 12, color: "#2b6cb0" }] }),
      one("Tamanho grande", { art: "guerreira", layout: { size: "LARGE" }, markers: [ca(), { name: "Defesa", mapLabel: "DEF", value: 12, color: "#2b6cb0" }] }),
    ],
  },
  {
    id: "tokens", title: "Tamanhos de token e vizinhos", map: "masmorra", description: "Criaturas de ½ a 3 células, imagem retangular e tokens lado a lado.",
    scenarios: [
      { title: "Minúsculo (½ célula)", cells: [2, 2], tokens: [{ at: [0.75, 0.75], size: 0.5, art: "goblin", markers: [ca()] }] },
      one("Médio (1 célula)", { art: "goblin", markers: [ca()] }),
      { title: "Grande (2×2)", cells: [4, 4], tokens: [{ at: [1, 1], size: 2, art: "urso", markers: [ca(17), { name: "Defesa", mapLabel: "DEF", value: 14, color: "#2b6cb0" }] }] },
      { title: "Enorme (3×3)", cells: [5, 5], tokens: [{ at: [1, 1], size: 3, art: "dragao", hp: [210, 256], markers: [ca(19), { name: "Fôlego", mapLabel: "SOPRO", kind: "checkbox", checked: true, color: "#c05621" }] }] },
      { title: "Imagem retangular (2×1)", cells: [4, 3], tokens: [{ at: [1, 1], size: [2, 1], art: "maga", markers: [ca()] }] },
      { title: "Vizinhos, centro", cells: [4, 3], tokens: [{ at: [1, 1], art: "goblin", markers: [ca(), { name: "Defesa", mapLabel: "DEF", value: 12, color: "#2b6cb0" }] }, { at: [2, 1], art: "esqueleto", hp: [9, 13], markers: [ca(13)] }] },
      { title: "Vizinhos, esquerda/direita", cells: [4, 3], tokens: [{ at: [1, 1], art: "goblin", layout: { horizontal: "RIGHT" }, markers: [ca()] }, { at: [2, 1], art: "esqueleto", hp: [9, 13], layout: { horizontal: "LEFT" }, markers: [ca(13)] }] },
      { title: "Vizinhos em coluna", cells: [3, 4], tokens: [{ at: [1, 1], art: "goblin", markers: [ca()] }, { at: [1, 2], art: "esqueleto", hp: [9, 13], layout: { position: "TOP" }, markers: [ca(13)] }] },
    ],
  },
  {
    id: "jogador", title: "Visão do jogador", map: "madeira", description: "O que cada jogador vê conforme a configuração do mestre.",
    scenarios: [
      one("HP completo", { art: "guerreira", markers: [ca()] }, { viewer: "PLAYER" }),
      one("HP em porcentagem", { art: "guerreira", hpMarker: { display: "PERCENT" }, markers: [ca()] }, { viewer: "PLAYER" }),
      one("HP oculto", { art: "guerreira", hpMarker: { display: "HIDDEN" }, markers: [ca()] }, { viewer: "PLAYER" }),
      one("Marcador só do mestre", { art: "guerreira", markers: [ca(15, { audience: { mode: "GM", playerIds: [] } })] }, { viewer: "PLAYER" }),
      one("Token invisível", { art: "esqueleto", visible: false, markers: [ca()] }, { viewer: "PLAYER" }),
      one("Token invisível (mestre)", { art: "esqueleto", visible: false, markers: [ca()] }),
    ],
  },
  {
    id: "mapas", title: "Contraste com o mapa", map: "madeira", description: "O mesmo token sobre mapas claros e escuros.",
    scenarios: (["madeira", "masmorra", "floresta", "neve"] as const).flatMap((map) => [
      one(`Mapa: ${map}`, { art: "esqueleto", hp: [9, 13], markers: [ca(13), { name: "Mana", mapLabel: "PM", kind: "bar", value: 2, maximum: 6, color: "#4c51bf" }] }, { map }),
      one(`Mapa: ${map}, acima`, { art: "guerreira", layout: { position: "TOP" }, markers: [ca()] }, { map }),
    ]),
  },
  {
    id: "zoom", title: "Zoom do mapa", map: "floresta", description: "Os marcadores acompanham a escala da cena.",
    scenarios: [0.5, 0.75, 1, 1.5].map((zoom) => one(`Zoom ${Math.round(zoom * 100)}%`, { art: "urso", markers: [ca(), { name: "Defesa", mapLabel: "DEF", value: 12, color: "#2b6cb0" }] }, { zoom })),
  },
];
