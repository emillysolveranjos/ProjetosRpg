import { useState } from "react";
import type { CombatantState, Marker, MarkerDisplayLayout, RulebearSceneState, TokenDisplayOverride, TokenView, Viewer } from "../domain/types";
import { allowed, markerEditable, markerNumbers, markerText, markerVisible, permitted } from "../domain/access";
import { useAppStore } from "../state/store";
import { AccessEditor } from "./AccessEditor";
import { MarkerEditor } from "./MarkerEditor";
import { ReductionEditor } from "./RuleEditors";
import { Dialog, TokenPortrait } from "./Shared";

interface Props {
  combatant: CombatantState; token?: TokenView; state: RulebearSceneState; viewer: Viewer;
  readOnly: boolean; previewing: boolean; expanded: boolean; onExpand(): void; onToggle(): void;
}
export function CompactCard({ combatant: c, token, state, viewer, readOnly, previewing, expanded, onExpand, onToggle }: Props) {
  const { command, preferences, setPreferences } = useAppStore();
  const [editor, setEditor] = useState<string | null>(null);
  const [modal, setModal] = useState<"access" | "markers" | "defenses" | null>(null);
  const [conditionId, setConditionId] = useState("");
  const [conditionOperation, setConditionOperation] = useState<"APPLY" | "INCREASE" | "DECREASE" | "REMOVE">("APPLY");
  const gm = viewer.role === "GM", active = state.activeTokenId === c.tokenId;
  const hp = c.markers.find((m) => m.hp)!;
  const canHp = permitted(c, viewer, "damage") || permitted(c, viewer, "heal") || permitted(c, viewer, "adjustCurrentHp") || permitted(c, viewer, "adjustMaximumHp");
  const showConditions = allowed(c.settings.visibility.conditions, c, viewer);
  const canConditions = permitted(c, viewer, "conditions");
  const markers = c.markers.filter((m) => markerVisible(m, c, viewer));
  const selectedMarker = markers.find((m) => m.id === editor);
  const preferenceKey = state.sceneId + "/" + c.tokenId;
  const displayOverride = preferences.overrides[preferenceKey] ?? {};
  const setDisplayOverride = <K extends keyof MarkerDisplayLayout>(field: K, value: "" | MarkerDisplayLayout[K]) => {
    const overrides = { ...preferences.overrides }, next: TokenDisplayOverride = { ...displayOverride };
    if (value) next[field] = value; else delete next[field];
    if (Object.keys(next).length) overrides[preferenceKey] = next; else delete overrides[preferenceKey];
    setPreferences({ ...preferences, overrides });
  };
  const open = (id: string) => { setEditor(id); onExpand(); };
  const index = state.encounter.order.indexOf(c.tokenId);
  const move = (delta: number) => {
    const order = [...state.encounter.order]; order.splice(index, 1); order.splice(index + delta, 0, c.tokenId);
    void command({ type: "order", order });
  };
  return <article className={`combatant-card compact-card ${active ? "active" : ""}`} aria-label={token?.name ?? "Combatente"}>
    <div className="combatant-main"><TokenPortrait token={token} /><div className="combatant-info"><div className="name-row"><h2 title={token?.name}>{token?.name ?? "Token removido"}</h2>{active && <span className="turn-chip">EM TURNO</span>}</div>
      {(allowed(c.settings.visibility.initiative, c, viewer) || permitted(c, viewer, "initiative")) && (permitted(c, viewer, "initiative") && !previewing ? <button className="initiative-value" aria-label="Editar iniciativa" onClick={() => open("initiative")} title="Editar iniciativa">Iniciativa <strong>{allowed(c.settings.visibility.initiative, c, viewer) ? c.initiative ?? "—" : "Informar"}</strong></button> : <span className="initiative-value">Iniciativa {allowed(c.settings.visibility.initiative, c, viewer) ? c.initiative ?? "—" : "Informar"}</span>)}
    </div><button className="icon-button details-toggle" aria-label={`Detalhes de ${token?.name ?? "combatente"}`} aria-expanded={expanded} aria-controls={`details-${c.tokenId}`} onClick={onToggle}>{expanded ? "−" : "⋯"}</button></div>
    <div className="compact-markers">{markers.map((m) => {
      const editable = !previewing && (m.hp ? canHp : markerEditable(m, c, viewer));
      const { value, maximum } = markerNumbers(m, c);
      const text = markerText(m, c, viewer);
      const fill = Math.max(0, Math.min(100, value / maximum * 100));
      const over = m.hp && value > maximum ? Math.min(100, (value - maximum) / maximum * 100) : 0;
      const contents = m.kind === "bar" ? <><span className="bar-name">{m.name}</span><span className="hp-track panel-hp-track"><span className="hp-fill" style={{ width: `${fill}%`, background: m.color }} />{over > 0 && <span className="hp-over" style={{ width: `${over}%` }} />}<strong>{text}</strong></span></> : <span className="marker-caption"><span>{m.name}</span><strong>{text}</strong></span>;
      return editable ? <button className={`resource-value ${m.kind === "bar" ? "bar-value" : "badge-value"}`} key={m.id} aria-label={`${m.hp ? "Ações de HP" : "Ajustar " + m.name}: ${markerText(m, c, viewer)}`} onClick={() => open(m.id)}>{contents}</button> : <div className={`resource-value readonly ${m.kind === "bar" ? "bar-value" : "badge-value"}`} key={m.id}>{contents}</div>;
    })}</div>
    {showConditions && c.conditions.length > 0 && <div className="condition-list">{c.conditions.map((a) => <span className="condition-chip" key={a.id}>{state.conditionDefinitions.find((d) => d.id === a.definitionId)?.name ?? "Condição"}{a.stacks > 1 && ` ×${a.stacks}`}{a.remainingTicks !== undefined && ` · ${a.remainingTicks}t`}</span>)}</div>}
    {active && !gm && permitted(c, viewer, "endTurn") && <button className="end-own-turn" disabled={readOnly} onClick={() => void command({ type: "advance" })}>Encerrar meu turno →</button>}
    {expanded && <section className="card-details" id={`details-${c.tokenId}`} aria-label="Detalhes do combatente">
      <div className="detail-tabs">{canHp && !previewing && <button className="button" onClick={() => open(hp.id)}>HP · Ações</button>}{(showConditions || canConditions) && <button className="button" onClick={() => open("conditions")}>Condições</button>}{allowed(c.settings.visibility.defenses, c, viewer) && <button className="button" onClick={() => setModal("defenses")}>Defesa</button>}</div>
      {editor === hp.id && canHp && !previewing && <HealthEditor key={hp.id} combatant={c} viewer={viewer} disabled={readOnly} />}
      {selectedMarker && !selectedMarker.hp && markerEditable(selectedMarker, c, viewer) && !previewing && <ValueEditor key={selectedMarker.id} marker={selectedMarker} combatant={c} disabled={readOnly} />}
      {editor === "initiative" && permitted(c, viewer, "initiative") && !previewing && <InitiativeEditor key={String(c.initiative)} combatant={c} showValue={allowed(c.settings.visibility.initiative, c, viewer)} disabled={readOnly} />}
      {editor === "conditions" && (showConditions || canConditions) && <div className="form-stack">
        {showConditions && <div className="condition-list">{c.conditions.map((a) => { const d = state.conditionDefinitions.find((item) => item.id === a.definitionId); return <span className="condition-chip" key={a.id}>{d?.name ?? "Condição"} · {a.stacks}{a.remainingTicks !== undefined && ` · ${a.remainingTicks}t`}{canConditions && <><button aria-label={`Diminuir ${d?.name}`} disabled={readOnly || a.stacks <= 1} onClick={() => void command({ type: "stacks", tokenId: c.tokenId, appliedId: a.id, delta: -1 })}>−</button><button aria-label={`Aumentar ${d?.name}`} disabled={readOnly || a.stacks >= (d?.maximumStacks ?? 1)} onClick={() => void command({ type: "stacks", tokenId: c.tokenId, appliedId: a.id, delta: 1 })}>+</button><button aria-label={`Remover ${d?.name}`} disabled={readOnly} onClick={() => void command({ type: "removeCondition", tokenId: c.tokenId, appliedId: a.id })}>×</button></>}</span>; })}</div>}
        {canConditions && <form className="condition-action-form" onSubmit={(e) => {
          e.preventDefault();
          const action = conditionOperation === "APPLY" ? { type: "condition" as const, tokenId: c.tokenId, definitionId: conditionId } : { type: "conditionByDefinition" as const, tokenId: c.tokenId, definitionId: conditionId, operation: conditionOperation };
          void command(action).then((ok) => { if (ok) setConditionId(""); });
        }}><label>Condição<select value={conditionId} onChange={(e) => setConditionId(e.target.value)}><option value="">Escolher…</option>{state.conditionDefinitions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>Operação<select value={conditionOperation} onChange={(e) => setConditionOperation(e.target.value as typeof conditionOperation)}><option value="APPLY">Aplicar</option><option value="INCREASE">Aumentar stacks</option><option value="DECREASE">Diminuir stacks</option><option value="REMOVE">Remover</option></select></label><button className="button" disabled={readOnly || !conditionId}>Executar</button></form>}
        {!showConditions && canConditions && <p className="muted">As condições aplicadas estão ocultas. A operação será executada sem revelar stacks ou duração.</p>}
      </div>}
      <div className="token-display-options" aria-label="Marcadores só na minha tela"><label>Posição vertical neste token<select disabled={previewing} value={displayOverride.position ?? ""} onChange={(e) => setDisplayOverride("position", e.target.value as "" | MarkerDisplayLayout["position"])}><option value="">Usar meu padrão</option><option value="TOP">Acima</option><option value="BOTTOM">Abaixo</option></select></label><label>Alinhamento neste token<select disabled={previewing} value={displayOverride.horizontal ?? ""} onChange={(e) => setDisplayOverride("horizontal", e.target.value as "" | MarkerDisplayLayout["horizontal"])}><option value="">Usar meu padrão</option><option value="LEFT">Esquerda</option><option value="CENTER">Centro</option><option value="RIGHT">Direita</option></select></label><label>Tamanho neste token<select disabled={previewing} value={displayOverride.size ?? ""} onChange={(e) => setDisplayOverride("size", e.target.value as "" | MarkerDisplayLayout["size"])}><option value="">Usar meu padrão</option><option value="SMALL">Pequeno</option><option value="MEDIUM">Médio</option><option value="LARGE">Grande</option></select></label></div>
      {gm && <div className="button-row"><button className="button" disabled={readOnly || index === 0} onClick={() => move(-1)}>↑ Ordem</button><button className="button" disabled={readOnly || index === state.encounter.order.length - 1} onClick={() => move(1)}>↓ Ordem</button>{!state.activeTokenId && <button className="button" disabled={readOnly} onClick={() => void command({ type: "start", tokenId: c.tokenId })}>Iniciar turno aqui</button>}<button className="button" onClick={() => setModal("access")}>Acesso</button><button className="button" onClick={() => setModal("markers")}>Marcadores</button><button className="text-button" disabled={readOnly} onClick={() => { if (confirm("Remover este combatente da Rulebear?")) void command({ type: "remove", tokenId: c.tokenId }); }}>Remover</button></div>}
    </section>}
    {modal === "access" && gm && expanded && <AccessEditor combatant={c} onClose={() => setModal(null)} />}
    {modal === "markers" && gm && expanded && <MarkerEditor combatant={c} onClose={() => setModal(null)} />}
    {modal === "defenses" && expanded && allowed(c.settings.visibility.defenses, c, viewer) && <Dialog title="Defesas" onClose={() => setModal(null)}>{gm ? <fieldset disabled={readOnly} className="dialog-guard"><ReductionEditor state={state} combatant={c} onDone={() => setModal(null)} /></fieldset> : c.reductions.length ? c.reductions.map((r) => <p key={r.id}>{r.label}: {r.amount} · {r.categories.join(", ") || "Todos os tipos"}</p>) : <p>Sem reduções.</p>}</Dialog>}
  </article>;
}

function HealthEditor({ combatant: c, viewer, disabled }: { combatant: CombatantState; viewer: Viewer; disabled: boolean }) {
  const canAdjustCurrent = permitted(c, viewer, "adjustCurrentHp"), canAdjustMaximum = permitted(c, viewer, "adjustMaximumHp");
  const modes = [permitted(c, viewer, "damage") && "damage", permitted(c, viewer, "heal") && "heal", (canAdjustCurrent || canAdjustMaximum) && "adjust"].filter((m): m is string => !!m);
  const [selected, setSelected] = useState(modes[0] ?? "");
  const mode = modes.includes(selected) ? selected : modes[0];
  const [value, setValue] = useState(""), [maximumValue, setMaximumValue] = useState(""), [categories, setCategories] = useState(""), [bypass, setBypass] = useState(false);
  const command = useAppStore((s) => s.command);
  const labels: Record<string, string> = { damage: "Dano", heal: "Cura", adjust: "Ajuste" };
  if (mode === "adjust") return <div className="context-editor"><div className="editor-modes" role="group" aria-label="Ação de HP">{modes.map((m) => <button key={m} aria-pressed={mode === m} onClick={() => { setSelected(m); setValue(""); setMaximumValue(""); }}>{labels[m]}</button>)}</div><div className="hp-adjust-grid">
    {canAdjustCurrent && <form className="quick-form" onSubmit={(e) => { e.preventDefault(); if (!disabled && value.trim()) void command({ type: "hpAdjust", tokenId: c.tokenId, target: "CURRENT", expression: value }).then((ok) => { if (ok) setValue(""); }); }}><label>Ajustar HP atual<input value={value} onChange={(e) => setValue(e.target.value)} placeholder="=10, +2, -3…" /></label><button className="button primary" disabled={disabled || !value.trim()}>Aplicar</button></form>}
    {canAdjustMaximum && <form className="quick-form" onSubmit={(e) => { e.preventDefault(); if (!disabled && maximumValue.trim()) void command({ type: "hpAdjust", tokenId: c.tokenId, target: "MAXIMUM", expression: maximumValue }).then((ok) => { if (ok) setMaximumValue(""); }); }}><label>Ajustar HP máximo<input value={maximumValue} onChange={(e) => setMaximumValue(e.target.value)} placeholder="=20, +5, /2…" /></label><button className="button primary" disabled={disabled || !maximumValue.trim()}>Aplicar</button></form>}
  </div></div>;
  return <div className="context-editor"><div className="editor-modes" role="group" aria-label="Ação de HP">{modes.map((m) => <button key={m} aria-pressed={mode === m} onClick={() => { setSelected(m); setValue(""); }}>{labels[m]}</button>)}</div><form className="form-stack" onSubmit={(e) => {
    e.preventDefault(); if (!mode || disabled) return;
    const action = mode === "damage" ? { type: "damage" as const, tokenId: c.tokenId, expression: value, categories: categories.split(","), bypass } : { type: "heal" as const, tokenId: c.tokenId, amount: Number(value) };
    void command(action).then((ok) => { if (ok) setValue(""); });
  }}><div className="quick-form"><label>{mode === "damage" ? "Dano (ex.: 2d6+3)" : "HP a recuperar"}<input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Valor" /></label><button className="button primary" disabled={disabled || !value.trim()}>Aplicar</button></div>{mode === "damage" && <details><summary>Tipos e reduções</summary><label>Tipos<input value={categories} onChange={(e) => setCategories(e.target.value)} placeholder="fogo, físico" /></label>{viewer.role === "GM" && <label className="check"><input type="checkbox" checked={bypass} onChange={(e) => setBypass(e.target.checked)} />Ignorar reduções</label>}</details>}</form></div>;
}
function ValueEditor({ marker: m, combatant: c, disabled }: { marker: Marker; combatant: CombatantState; disabled: boolean }) {
  const [expression, setExpression] = useState(""); const command = useAppStore((s) => s.command);
  if (m.kind === "checkbox") return <label className="check"><input type="checkbox" checked={m.checked} disabled={disabled} onChange={(e) => void command({ type: "markerValue", tokenId: c.tokenId, markerId: m.id, checked: e.target.checked })} />{m.name}</label>;
  const adjust = (value: string) => command({ type: "markerValue", tokenId: c.tokenId, markerId: m.id, expression: value });
  return <form className="quick-form context-editor" onSubmit={(e) => { e.preventDefault(); if (!disabled) void adjust(expression).then((ok) => { if (ok) setExpression(""); }); }}><label>Ajustar {m.name}<input value={expression} onChange={(e) => setExpression(e.target.value)} placeholder="=10, +2, -3…" /></label>{m.kind === "counter" && <div className="counter-controls"><button type="button" aria-label={`Diminuir ${m.name}`} disabled={disabled} onClick={() => void adjust("-1")}>−</button><button type="button" aria-label={`Aumentar ${m.name}`} disabled={disabled} onClick={() => void adjust("+1")}>+</button></div>}<button className="button" disabled={disabled || !expression.trim()}>Aplicar</button></form>;
}
function InitiativeEditor({ combatant: c, showValue, disabled }: { combatant: CombatantState; showValue: boolean; disabled: boolean }) {
  const [value, setValue] = useState(showValue && c.initiative !== null ? String(c.initiative) : "");
  const { command, state } = useAppStore(); const [revision] = useState(state.revision);
  return <form className="quick-form context-editor" onSubmit={(e) => { e.preventDefault(); if (!disabled) void command({ type: "initiative", tokenId: c.tokenId, value: value.trim() ? Number(value) : null }, revision); }}><label>Minha iniciativa<input type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} /></label><button className="button" disabled={disabled}>Salvar</button></form>;
}
