import type { PanelTheme } from "../owlbear/gateway";

/** Aplica a paleta do Owlbear às variáveis CSS do painel. */
export function applyTheme(theme: PanelTheme): void {
  const root = document.documentElement;
  root.dataset.theme = theme.mode.toLowerCase();
  const vars: Record<string, string> = {
    "--accent": theme.primary,
    "--accent-ink": theme.primaryContrast,
    "--surface": theme.paper,
    "--backdrop": theme.background,
    "--ink": theme.text,
    "--muted": theme.textSecondary,
  };
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
}
