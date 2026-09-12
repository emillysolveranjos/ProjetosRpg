import { useState } from "react";
import type { Audience, CombatantState, Participant } from "../domain/types";
import { useAppStore } from "../state/store";
import { Dialog } from "./Shared";
export function AudienceEditor({ label, value, onChange, players }: { label: string; value: Audience; onChange(value: Audience): void; players: Participant[] }) {
  return <div className="audience-editor"><label>{label}<select value={value.mode} onChange={(e) => onChange({ ...value, mode: e.target.value as Audience["mode"] })}><option value="GM">Somente mestres</option><option value="ALL">Todos</option><option value="OWNERS">Responsáveis</option><option value="SELECTED">Jogadores específicos</option></select></label>{value.mode === "SELECTED" && <PlayerChecks players={players} selected={value.playerIds} onChange={(playerIds) => onChange({ ...value, playerIds })} />}</div>;
}
export function PlayerChecks({ players, selected, onChange }: { players: Participant[]; selected: string[]; onChange(ids: string[]): void }) {
  const unique = [...new Map(players.filter((p) => p.role === "PLAYER").map((p) => [p.id, p])).values()];
  const all = [...unique, ...selected.filter((id) => !unique.some((p) => p.id === id)).map((id) => ({ id, name: "Jogador desconectado (" + id.slice(0, 6) + ")" }))];
  return <div className="player-checks">{all.map((p) => <label className="check" key={p.id}><input type="checkbox" checked={selected.includes(p.id)} onChange={(e) => onChange(e.target.checked ? [...selected, p.id] : selected.filter((id) => id !== p.id))} />{p.name}</label>)}{!all.length && <small>Os jogadores aparecerão quando entrarem na sala.</small>}</div>;
}
export function AccessEditor({ combatant, onClose }: { combatant: CombatantState; onClose(): void }) {
  const [revision] = useState(useAppStore.getState().state.revision);
  const [draft, setDraft] = useState(() => structuredClone(combatant.settings));
  const { participants, busy, online } = useAppStore();
  const visibilityLabels = { identity: "Nome e participação", initiative: "Valor da iniciativa", defenses: "Defesas", conditions: "Condições", history: "Histórico" };
  const permissionLabels = { initiative: "Informar iniciativa", damage: "Aplicar dano", heal: "Aplicar cura", conditions: "Alterar condições", endTurn: "Encerrar o próprio turno" };
  return <Dialog title="Acesso ao token" onClose={onClose}><div className="form-stack"><strong>Responsáveis pelo token</strong><PlayerChecks players={participants} selected={draft.owners} onChange={(owners) => setDraft({ ...draft, owners })} /><h3>Quem pode ver</h3>{Object.entries(visibilityLabels).map(([key, label]) => <AudienceEditor key={key} label={label} value={draft.visibility[key as keyof typeof draft.visibility]} players={participants} onChange={(value) => setDraft({ ...draft, visibility: { ...draft.visibility, [key]: value } })} />)}<h3>Ações dos responsáveis</h3>{Object.entries(permissionLabels).map(([key, label]) => <label className="check" key={key}><input type="checkbox" checked={draft.permissions[key as keyof typeof draft.permissions]} onChange={(e) => setDraft({ ...draft, permissions: { ...draft.permissions, [key]: e.target.checked } })} />{label}</label>)}<p className="muted">Libere também o nome e a participação para permitir as ações. Acesso aos marcadores é configurado em “Marcadores”. Ocultação vale para a interface; os dados permanecem na cena.</p><button className="button primary" disabled={busy || !online} onClick={() => void useAppStore.getState().command({ type: "settings", tokenId: combatant.tokenId, settings: draft }, revision).then((ok) => { if (ok) onClose(); })}>Salvar acesso</button></div></Dialog>;
}
