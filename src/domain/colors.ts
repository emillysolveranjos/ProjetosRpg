export const DEFAULT_HP_COLOR = "#d94848";
/** Cor de faixa vazia das barras e de marcações desligadas no mapa. */
export const TRACK_COLOR = "#202b30";
export interface HealthShades { high: string; middle: string }
/** Painel: o texto da barra tem sombra, então os tons podem ser claros. */
export const PANEL_SHADES: HealthShades = { high: "#3fae6a", middle: "#e0a21b" };
/** Mapa: etiquetas do Owlbear não têm sombra; tons mais escuros mantêm o texto branco legível. */
export const MAP_SHADES: HealthShades = { high: "#2e8b57", middle: "#b7791f" };
// A cor padrão do HP vira um indicador de saúde; cores escolhidas pelo mestre são respeitadas.
export function hpColor(color: string, value: number, maximum: number, shades: HealthShades = PANEL_SHADES): string {
  if (color.toLowerCase() !== DEFAULT_HP_COLOR) return color;
  const ratio = value / maximum;
  return ratio > .5 ? shades.high : ratio > .25 ? shades.middle : DEFAULT_HP_COLOR;
}
