import { useState } from "react";
import type { Audience, CombatantState, Participant, PermissionKey } from "../domain/types";
import { useAppStore } from "../state/store";
import { Dialog } from "./Shared";

export function AudienceEditor({ label, value, onChange, players }: { label: string; value: Audience; onChange(value: Audience): void; players: Participant[] }) {
  return <div className="audience-editor"><label>{label}<select value={value.mode} onChange={(e) => onChange({ ...value, mode: e.target.value as Audience["mode"] })}><option value="GM">Somente mestres</option><option value="ALL">Todos</option><option value="OWNERS">Responsáveis</option><option value="SELECTED">Jogadores específicos</option></select></label>{value.mode === "SELECTED" && <PlayerChecks players={players} selected={value.playerIds} onChange={(playerIds) => onChange({ ...value, playerIds })} />}</div>;
}

function knownPlayers(players: Participant[], selected: string[]) {
  const connected = [...new Map(players.filter((p) => p.role === "PLAYER").map((p) => [p.id, p])).values()];
  return [...connected, ...selected.filter((id) => !connected.some((p) => p.id === id)).map((id) => ({ id, connectionId: "", role: "PLAYER" as const, name: `Jogador desconectado (${id.slice(0, 6)})` }))];
}

export function PlayerChecks({ players, selected, onChange }: { players: Participant[]; selected: string[]; onChange(ids: string[]): void }) {
  const all = knownPlayers(players, selected);
  return <div className="player-checks">{all.map((p) => <label className="check" key={p.id}><input type="checkbox" checked={selected.includes(p.id)} onChange={(e) => onChange(e.target.checked ? [...new Set([...selected, p.id])] : selected.filter((id) => id !== p.id))} />{p.name}</label>)}{!all.length && <small>Os jogadores aparecerão quando entrarem na sala.</small>}</div>;
}

const permissionLabels: Record<PermissionKey, string> = {
  initiative: "Informar iniciativa",
  damage: "Aplicar dano",
  heal: "Aplicar cura",
  adjustCurrentHp: "Ajustar HP atual",
  adjustMaximumHp: "Ajustar HP máximo",
  conditions: "Alterar condições",
  endTurn: "Encerrar o próprio turno",
};

export function AccessEditor({ combatant, onClose }: { combatant: CombatantState; onClose(): void }) {
  const [revision] = useState(useAppStore.getState().state.revision);
  const [draft, setDraft] = useState(() => structuredClone(combatant.settings));
  const { participants, busy, online } = useAppStore();
  const visibilityLabels = { identity: "Nome e participação", initiative: "Valor da iniciativa", defenses: "Defesas", conditions: "Condições", history: "Histórico" };
  const permissionIds = Object.values(draft.permissions).flat();
  const players = knownPlayers(participants, [...new Set([...draft.owners, ...permissionIds])]);
  const setPermission = (key: PermissionKey, playerId: string, checked: boolean) => {
    const current = draft.permissions[key];
    const value = checked ? [...new Set([...current, playerId])] : current.filter((id) => id !== playerId);
    setDraft({ ...draft, permissions: { ...draft.permissions, [key]: value } });
  };
  return <Dialog title="Acesso ao token" onClose={onClose}><div className="form-stack">
    <strong>Responsáveis pelo token</strong>
    <PlayerChecks players={participants} selected={draft.owners} onChange={(owners) => setDraft({ ...draft, owners })} />
    <h3>Quem pode ver</h3>
    {Object.entries(visibilityLabels).map(([key, label]) => <AudienceEditor key={key} label={label} value={draft.visibility[key as keyof typeof draft.visibility]} players={participants} onChange={(value) => setDraft({ ...draft, visibility: { ...draft.visibility, [key]: value } })} />)}
    <h3>Permissões por jogador</h3>
    {players.map((player) => <section className="permission-player" key={player.id}><strong>{player.name}</strong>{Object.entries(permissionLabels).map(([key, label]) => <label className="check" key={key}><input type="checkbox" checked={draft.permissions[key as PermissionKey].includes(player.id)} onChange={(e) => setPermission(key as PermissionKey, player.id, e.target.checked)} />{label}</label>)}</section>)}
    {!players.length && <p className="muted">Os cartões de permissão aparecerão quando jogadores entrarem na sala.</p>}
    <p className="muted">O token também precisa estar liberado em “Nome e participação”. Dano, cura, ajustes de HP e condições não exigem responsabilidade. Iniciativa e encerramento do turno exigem que o jogador também seja responsável.</p>
    <button className="button primary" disabled={busy || !online} onClick={() => void useAppStore.getState().command({ type: "settings", tokenId: combatant.tokenId, settings: draft }, revision).then((ok) => { if (ok) onClose(); })}>Salvar acesso</button>
  </div></Dialog>;
}
