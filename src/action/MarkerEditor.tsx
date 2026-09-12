import { useState } from "react";
import type { CombatantState, Marker } from "../domain/types";
import { defaultMarker } from "../domain/defaults";
import { readOwlTrackers, mergeImported, type ImportCandidate } from "../domain/import-trackers";
import { useAppStore } from "../state/store";
import { Dialog } from "./Shared";
import { AudienceEditor } from "./AccessEditor";
export function MarkerEditor({ combatant, onClose }: { combatant: CombatantState; onClose(): void }) {
  const { state, participants, gateway, busy, online } = useAppStore();
  const [revision, setRevision] = useState(state.revision);
  const [original] = useState(JSON.stringify(combatant));
  const [markers, setMarkers] = useState(() => structuredClone(combatant.markers));
  const [hp, setHp] = useState(combatant.currentHp), [maxHp, setMaxHp] = useState(combatant.maximumHp);
  const [error, setError] = useState(""), [name, setName] = useState("");
  const [imports, setImports] = useState<ImportCandidate[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]), [hpSource, setHpSource] = useState("");
  const [mode, setMode] = useState<"append" | "replace">("append");
  const update = (id: string, patch: Partial<Marker>) => setMarkers(markers.map((m) => m.id === id ? { ...m, ...patch } : m));
  function move(index: number, delta: number) { const next = [...markers]; const [m] = next.splice(index, 1); if (m) next.splice(index + delta, 0, m); setMarkers(next); }
  async function loadImport() {
    try {
      const candidates = readOwlTrackers(await gateway!.getTokenMetadata(combatant.tokenId));
      setImports(candidates); setSelected(candidates.map((c) => c.sourceId)); setError("");
    } catch { setError("Não foi possível ler os marcadores do token."); }
  }
  function applyImport() {
    try {
      const result = mergeImported(markers, (imports ?? []).filter((c) => selected.includes(c.sourceId)), hpSource, mode);
      setMarkers(result.markers);
      if (result.currentHp !== undefined) setHp(result.currentHp);
      if (result.maximumHp !== undefined) setMaxHp(result.maximumHp);
      setImports(null); setError("");
    } catch (error) { setError(error instanceof Error ? error.message : "Importação inválida."); }
  }
  return <Dialog title="Marcadores do token" onClose={onClose}><div className="form-stack">
    <p className="muted">Até 12 marcadores, incluindo HP. As alterações só são aplicadas ao salvar.</p>
    {error && <p role="alert">{error}</p>}
    {markers.map((m, index) => <fieldset className="marker-editor" key={m.id}><legend>{m.hp ? "HP do combate" : "Marcador " + (index + 1)}</legend>
      <div className="form-grid"><label>Nome<input value={m.name} maxLength={50} onChange={(e) => update(m.id, { name: e.target.value })} /></label><label>Cor<input type="color" value={m.color} onChange={(e) => update(m.id, { color: e.target.value })} /></label></div>
      {!m.hp && <label>Tipo<select value={m.kind} onChange={(e) => update(m.id, { kind: e.target.value as Marker["kind"], display: m.display === "PERCENT" ? "FULL" : m.display })}><option value="bar">Barra atual/máximo</option><option value="number">Número</option><option value="counter">Contador</option><option value="checkbox">Marcação</option></select></label>}
      {m.kind === "checkbox" ? <label className="check"><input type="checkbox" checked={m.checked} onChange={(e) => update(m.id, { checked: e.target.checked })} />Marcado</label> : <div className="form-grid"><label>Atual<input type="number" step={m.hp ? "1" : "any"} value={m.hp ? hp : m.value} onChange={(e) => m.hp ? setHp(Number(e.target.value)) : update(m.id, { value: Number(e.target.value) })} /></label>{m.kind === "bar" && <label>Máximo<input type="number" min="1" step={m.hp ? "1" : "any"} value={m.hp ? maxHp : m.maximum} onChange={(e) => m.hp ? setMaxHp(Number(e.target.value)) : update(m.id, { maximum: Number(e.target.value) })} /></label>}</div>}
      <AudienceEditor label="Quem vê este marcador" value={m.audience} players={participants} onChange={(audience) => update(m.id, { audience })} />
      <label>Exibição para jogadores<select value={m.display} onChange={(e) => update(m.id, { display: e.target.value as Marker["display"] })}><option value="FULL">Valores completos</option>{m.kind === "bar" && <option value="PERCENT">Somente porcentagem</option>}<option value="HIDDEN">Oculto</option></select></label>
      <label className="check"><input type="checkbox" checked={m.onMap} onChange={(e) => update(m.id, { onMap: e.target.checked })} />Mostrar no mapa</label>
      <label className="check"><input type="checkbox" checked={m.editable} onChange={(e) => update(m.id, { editable: e.target.checked })} />Responsáveis podem editar o valor completo</label>
      <div className="button-row"><button className="button" disabled={index === 0} onClick={() => move(index, -1)}>↑</button><button className="button" disabled={index === markers.length - 1} onClick={() => move(index, 1)}>↓</button>{!m.hp && <button className="button" onClick={() => setMarkers(markers.filter((item) => item.id !== m.id))}>Remover</button>}</div>
    </fieldset>)}
    <button className="button" disabled={markers.length >= 12} onClick={() => setMarkers([...markers, defaultMarker()])}>+ Marcador</button>
    <details><summary>Modelos da cena</summary><div className="form-stack"><label>Nome do modelo<input value={name} onChange={(e) => setName(e.target.value)} /></label><button className="button" disabled={!name.trim() || busy || !online} onClick={() => void useAppStore.getState().command({ type: "template", template: { id: crypto.randomUUID(), name: name.trim(), markers } }).then((ok) => { const latest = useAppStore.getState().state; if (ok && JSON.stringify(latest.combatants[combatant.tokenId]) === original) setRevision(latest.revision); })}>Salvar como modelo</button>{state.templates.map((t) => <div className="button-row" key={t.id}><button className="button" onClick={() => { setMarkers(t.markers.map((m) => ({ ...structuredClone(m), id: m.hp ? "hp" : crypto.randomUUID() }))); }}>{t.name} · Usar</button><button className="button" disabled={busy || !online} onClick={() => void useAppStore.getState().command({ type: "deleteTemplate", templateId: t.id })}>Excluir</button></div>)}</div></details>
    <button className="button" onClick={() => void loadImport()}>Importar do Owl Trackers…</button>
    {imports && <fieldset className="form-stack"><legend>Prévia da importação</legend>{!imports.length && <p>Nenhum marcador compatível encontrado neste token.</p>}{imports.map((item) => <label className="check" key={item.sourceId}><input type="checkbox" checked={selected.includes(item.sourceId)} onChange={(e) => setSelected(e.target.checked ? [...selected, item.sourceId] : selected.filter((id) => id !== item.sourceId))} />{item.marker.name} · {item.marker.kind === "checkbox" ? item.marker.checked ? "✓" : "○" : item.marker.value + (item.marker.kind === "bar" ? "/" + item.marker.maximum : "")}</label>)}<label>Barra que corresponde ao HP<select value={hpSource} onChange={(e) => setHpSource(e.target.value)}><option value="">Manter HP atual</option>{imports.filter((c) => c.marker.kind === "bar" && selected.includes(c.sourceId)).map((c) => <option key={c.sourceId} value={c.sourceId}>{c.marker.name}</option>)}</select></label><label>Marcadores existentes<select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}><option value="append">Manter e acrescentar</option><option value="replace">Substituir personalizados</option></select></label><button className="button" disabled={!selected.length} onClick={applyImport}>Usar seleção no rascunho</button><p className="muted">Os dados do Owl Trackers serão preservados. Após salvar e conferir, desative-o na sala para evitar barras duplicadas.</p></fieldset>}
    <button className="button primary" disabled={busy || !online} onClick={() => void useAppStore.getState().command({ type: "markers", tokenId: combatant.tokenId, markers, currentHp: hp, maximumHp: maxHp }, revision).then((ok) => { if (ok) onClose(); })}>Salvar marcadores</button>
  </div></Dialog>;
}
