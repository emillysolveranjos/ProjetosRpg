import type { Audience, CombatantState, Marker, RulebearSceneState, Viewer, HistoryEvent, HistoryEventView, HistoryEntryView } from "./types";
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
/** Texto da bolinha no mapa: a sigla identifica o valor, como "CA 15". */
export function markerMapText(m: Marker, c: CombatantState, viewer: Viewer): string {
  // No mapa, o círculo grande deixa a marcação desligada legível mesmo em bolinhas pequenas.
  const value = m.kind === "checkbox" && !m.checked ? "◯" : markerText(m, c, viewer);
  const label = m.mapLabel?.trim();
  return label ? `${label} ${value}` : value;
}
// Números de dano/cura revelam o HP: só aparecem para quem vê o HP completo (e as defesas, no caso do dano).
function eventForViewer(state: RulebearSceneState, event: HistoryEvent, viewer: Viewer): HistoryEventView | undefined {
  const c = state.combatants[event.tokenId];
  if (!c || !visibleCombatant(c, viewer)) return undefined;
  if (event.kind === "TURN") return event;
  if (!allowed(c.settings.visibility.history, c, viewer)) return undefined;
  if (event.kind === "CONDITION") return allowed(c.settings.visibility.conditions, c, viewer) ? event : undefined;
  const hp = c.markers.find((marker) => marker.hp);
  const full = !!hp && markerVisible(hp, c, viewer) && hp.display === "FULL"
    && (event.kind !== "DAMAGE" || allowed(c.settings.visibility.defenses, c, viewer))
    && (event.kind === "HP" || !event.source || allowed(c.settings.visibility.conditions, c, viewer));
  return full ? event : { kind: event.kind, tokenId: event.tokenId, hidden: true };
}

export function visibleHistory(state: RulebearSceneState, viewer: Viewer): HistoryEntryView[] {
  if (viewer.role === "GM") return state.history;
  return state.history.flatMap((entry) => {
    const events = entry.events?.flatMap((event) => eventForViewer(state, event, viewer) ?? []);
    const c = entry.tokenId ? state.combatants[entry.tokenId] : undefined;
    if (events) { if (!events.length) return []; }
    else if (!c || !visibleCombatant(c, viewer) || !allowed(c.settings.visibility.history, c, viewer)) return [];
    // Legacy summaries can contain hidden values and condition names. Never reuse them for players.
    const damageDetails = entry.damageDetails?.filter((detail) => {
      const target = state.combatants[detail.tokenId];
      if (!target || !visibleCombatant(target, viewer) || !allowed(target.settings.visibility.history, target, viewer) || !allowed(target.settings.visibility.defenses, target, viewer)) return false;
      const hp = target.markers.find((marker) => marker.hp);
      return !!hp && markerVisible(hp, target, viewer) && hp.display === "FULL" && (!detail.source || allowed(target.settings.visibility.conditions, target, viewer));
    });
    return [{ id: entry.id, ...(entry.tokenId ? { tokenId: entry.tokenId } : {}), kind: entry.kind, occurredAt: entry.occurredAt, undoneAt: entry.undoneAt, summary: "Informações do combatente atualizadas.", ...(damageDetails?.length ? { damageDetails } : {}), ...(events ? { events } : {}) }];
  });
}
