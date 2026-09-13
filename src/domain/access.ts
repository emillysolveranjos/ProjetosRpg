import type { Audience, CombatantState, Marker, RulebearSceneState, Viewer, HistoryEntry } from "./types";
export function allowed(audience: Audience, combatant: CombatantState, viewer: Viewer): boolean {
  return viewer.role === "GM" || audience.mode === "ALL" || (audience.mode === "OWNERS" && combatant.settings.owners.includes(viewer.id)) || (audience.mode === "SELECTED" && audience.playerIds.includes(viewer.id));
}
export function visibleCombatant(c: CombatantState, viewer: Viewer): boolean {
  return allowed(c.settings.visibility.identity, c, viewer);
}
export function permitted(c: CombatantState, viewer: Viewer, action: keyof CombatantState["settings"]["permissions"]): boolean {
  if (viewer.role === "GM") return true;
  if (!visibleCombatant(c, viewer) || !c.settings.permissions[action].includes(viewer.id)) return false;
  return action !== "initiative" && action !== "endTurn" || c.settings.owners.includes(viewer.id);
}
export function markerVisible(m: Marker, c: CombatantState, viewer: Viewer): boolean {
  return viewer.role === "GM" || (visibleCombatant(c, viewer) && m.display !== "HIDDEN" && allowed(m.audience, c, viewer));
}
export function markerEditable(m: Marker, c: CombatantState, viewer: Viewer): boolean {
  return viewer.role === "GM" || (markerVisible(m, c, viewer) && m.display === "FULL" && m.editable && c.settings.owners.includes(viewer.id));
}
export function markerNumbers(m: Marker, c: CombatantState) {
  return m.hp ? { value: c.currentHp, maximum: c.maximumHp } : { value: m.value, maximum: m.maximum };
}
export function markerText(m: Marker, c: CombatantState, viewer: Viewer): string {
  const { value, maximum } = markerNumbers(m, c);
  if (m.kind === "checkbox") return m.checked ? "✓" : "○";
  if (m.kind !== "bar") return String(value);
  if (viewer.role !== "GM" && m.display === "PERCENT") return `${Math.round(value / maximum * 100)}%`;
  return `${value}/${maximum}`;
}
export function visibleHistory(state: RulebearSceneState, viewer: Viewer): HistoryEntry[] {
  if (viewer.role === "GM") return state.history;
  return state.history.flatMap((entry) => {
    const c = entry.tokenId ? state.combatants[entry.tokenId] : undefined;
    if (!c || !visibleCombatant(c, viewer) || !allowed(c.settings.visibility.history, c, viewer)) return [];
    // Legacy summaries can contain hidden values and condition names. Never reuse them for players.
    return [{ id: entry.id, tokenId: entry.tokenId, kind: entry.kind, occurredAt: entry.occurredAt, undoneAt: entry.undoneAt, summary: "Informações do combatente atualizadas." }];
  });
}
