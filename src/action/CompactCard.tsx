import { useRef, useState } from "react";
import type { CombatantState, DamageComponent, Marker, MarkerDisplayLayout, RulebearSceneState, TokenDisplayOverride, TokenView, Viewer } from "../domain/types";
import { allowed, markerEditable, markerNumbers, markerText, markerVisible, permitted } from "../domain/access";
import { useAppStore } from "../state/store";
import { AccessEditor } from "./AccessEditor";
import { MarkerEditor } from "./MarkerEditor";
import { blankDamageComponent, DamageComponentRows, ReductionEditor } from "./RuleEditors";
import { Dialog, TokenPortrait } from "./Shared";

interface Props {
  combatant: CombatantState; token?: TokenView; state: RulebearSceneState; viewer: Viewer;
  readOnly: boolean; previewing: boolean; expanded: boolean; onExpand(): void; onToggle(): void;
  editingInitiative: boolean; onEditInitiative(editing: boolean): void; onInitiativeSaved(): void;
}
const DEFAULT_HP_COLOR = "#d94848";
// A cor padrão do HP vira um indicador de saúde; cores escolhidas pelo mestre são respeitadas.
export function hpColor(color: string, value: number, maximum: number): string {
  if (color.toLowerCase() !== DEFAULT_HP_COLOR) return color;
  const ratio = value / maximum;
  return ratio > .5 ? "#3fae6a" : ratio > .25 ? "#e0a21b" : DEFAULT_HP_COLOR;
}
export function CompactCard({ combatant: c, token, state, viewer, readOnly, previewing, expanded, onExpand, onToggle, editingInitiative, onEditInitiative, onInitiativeSaved }: Props) {
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
  const showInitiative = allowed(c.settings.visibility.initiative, c, viewer), canInitiative = permitted(c, viewer, "initiative") && !previewing;
  const initiativeLabel = showInitiative ? c.initiative : "?";
  const renderMarker = (m: Marker) => {
    const editable = !previewing && (m.hp ? canHp : markerEditable(m, c, viewer));
    const { value, maximum } = markerNumbers(m, c);
    const text = markerText(m, c, viewer);
    const fill = Math.max(0, Math.min(100, value / maximum * 100));
    const over = m.hp && value > maximum ? Math.min(100, (value - maximum) / maximum * 100) : 0;
    const contents = m.kind === "bar" ? <>{!m.hp && <span className="bar-name">{m.name}</span>}<span className="hp-track panel-hp-track"><span className="hp-fill" style={{ width: `${fill}%`, background: m.hp ? hpColor(m.color, value, maximum) : m.color }} />{over > 0 && <span className="hp-over" style={{ width: `${over}%` }} />}<strong>{text}</strong></span></> : <span className="marker-caption"><span>{m.name}</span><strong>{text}</strong></span>;
    return editable ? <button className={`resource-value ${m.kind === "bar" ? "bar-value" : "badge-value"}`} key={m.id} aria-label={`${m.hp ? "Ações de HP" : "Ajustar " + m.name}: ${markerText(m, c, viewer)}`} title={m.hp ? "Dano, cura ou ajuste" : undefined} onClick={() => open(m.id)}>{contents}</button> : <div className={`resource-value readonly ${m.kind === "bar" ? "bar-value" : "badge-value"}`} key={m.id}>{contents}</div>;
  };
  const hpMarker = markers.find((m) => m.hp), otherMarkers = markers.filter((m) => !m.hp);
  const down = !!hpMarker && c.currentHp <= 0;
  return <article className={`combatant-card compact-card ${active ? "active" : ""} ${down ? "down" : ""}`} aria-label={token?.name ?? "Combatente"}>
    <div className="combatant-main">
      {(showInitiative || canInitiative) && (editingInitiative && canInitiative ? <InitiativeInput combatant={c} showValue={showInitiative} disabled={readOnly} onCancel={() => onEditInitiative(false)} onSaved={onInitiativeSaved} /> : canInitiative ? <button className={`initiative-badge ${initiativeLabel === null ? "empty" : ""}`} aria-label="Editar iniciativa" title="Iniciativa · clique para editar" onClick={() => onEditInitiative(true)}>{initiativeLabel ?? <small>INI</small>}</button> : <span className={`initiative-badge ${initiativeLabel === null ? "empty" : ""}`} title="Iniciativa">{initiativeLabel ?? <small>INI</small>}</span>)}
      <TokenPortrait token={token} />
      <div className="combatant-info"><div className="name-row"><h2 title={token?.name}>{token?.name ?? "Token removido"}</h2>{active && <span className="turn-chip">EM TURNO</span>}{down && <span className="down-chip">CAÍDO</span>}</div>
        {hpMarker && renderMarker(hpMarker)}
      </div><button className="icon-button details-toggle" aria-label={`Detalhes de ${token?.name ?? "combatente"}`} aria-expanded={expanded} aria-controls={`details-${c.tokenId}`} onClick={onToggle}>{expanded ? "−" : "⋯"}</button></div>
    {otherMarkers.length > 0 && <div className="compact-markers">{otherMarkers.map(renderMarker)}</div>}
    {showConditions && c.conditions.length > 0 && <div className="condition-list">{c.conditions.map((a) => <span className="condition-chip" key={a.id}>{state.conditionDefinitions.find((d) => d.id === a.definitionId)?.name ?? "Condição"}{a.stacks > 1 && ` ×${a.stacks}`}{a.remainingTicks !== undefined && ` · ${a.remainingTicks}t`}</span>)}</div>}
    {active && !gm && permitted(c, viewer, "endTurn") && <button className="end-own-turn" disabled={readOnly} onClick={() => void command({ type: "advance" })}>Encerrar meu turno →</button>}
    {expanded && <section className="card-details" id={`details-${c.tokenId}`} aria-label="Detalhes do combatente">
      <nav className="detail-tabs" aria-label="Ações de combate">{canHp && !previewing && <button className="button" aria-pressed={editor === hp.id} onClick={() => open(hp.id)}>♥ HP</button>}{(showConditions || canConditions) && <button className="button" aria-pressed={editor === "conditions"} onClick={() => open("conditions")}>◈ Condições <b>{showConditions ? c.conditions.length : ""}</b></button>}{allowed(c.settings.visibility.defenses, c, viewer) && <button className="button" aria-pressed={modal === "defenses"} onClick={() => setModal("defenses")}>◆ Defesas <b>{c.reductions.length}</b></button>}</nav>
      {editor === hp.id && canHp && !previewing && <HealthEditor key={hp.id} combatant={c} viewer={viewer} disabled={readOnly} />}
      {selectedMarker && !selectedMarker.hp && markerEditable(selectedMarker, c, viewer) && !previewing && <ValueEditor key={selectedMarker.id} marker={selectedMarker} combatant={c} disabled={readOnly} />}
      {editor === "conditions" && (showConditions || canConditions) && <div className="form-stack">
        {showConditions && <div className="condition-list">{c.conditions.map((a) => { const d = state.conditionDefinitions.find((item) => item.id === a.definitionId); return <span className="condition-chip" key={a.id}>{d?.name ?? "Condição"} · {a.stacks}{a.remainingTicks !== undefined && ` · ${a.remainingTicks}t`}{canConditions && <><button aria-label={`Diminuir ${d?.name}`} disabled={readOnly || a.stacks <= 1} onClick={() => void command({ type: "stacks", tokenId: c.tokenId, appliedId: a.id, delta: -1 })}>−</button><button aria-label={`Aumentar ${d?.name}`} disabled={readOnly || a.stacks >= (d?.maximumStacks ?? 1)} onClick={() => void command({ type: "stacks", tokenId: c.tokenId, appliedId: a.id, delta: 1 })}>+</button><button aria-label={`Remover ${d?.name}`} disabled={readOnly} onClick={() => void command({ type: "removeCondition", tokenId: c.tokenId, appliedId: a.id })}>×</button></>}</span>; })}</div>}
        {canConditions && <form className="condition-action-form" onSubmit={(e) => {
          e.preventDefault();
          const action = conditionOperation === "APPLY" ? { type: "condition" as const, tokenId: c.tokenId, definitionId: conditionId } : { type: "conditionByDefinition" as const, tokenId: c.tokenId, definitionId: conditionId, operation: conditionOperation };
          void command(action).then((ok) => { if (ok) setConditionId(""); });
        }}><label>Condição<select value={conditionId} onChange={(e) => setConditionId(e.target.value)}><option value="">Escolher…</option>{state.conditionDefinitions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>Operação<select value={conditionOperation} onChange={(e) => setConditionOperation(e.target.value as typeof conditionOperation)}><option value="APPLY">Aplicar</option><option value="INCREASE">Aumentar stacks</option><option value="DECREASE">Diminuir stacks</option><option value="REMOVE">Remover</option></select></label><button className="button" disabled={readOnly || !conditionId}>Executar</button></form>}
        {!showConditions && canConditions && <p className="muted">As condições aplicadas estão ocultas. A operação será executada sem revelar stacks ou duração.</p>}
      </div>}
      <details className="personal-view" open={!!Object.keys(displayOverride).length}><summary>Marcadores deste token na minha tela{Object.keys(displayOverride).length > 0 && <b> · personalizado</b>}</summary><p className="muted">Só muda sua tela; vazio usa seu padrão da engrenagem.</p><div className="token-display-options" aria-label="Marcadores só na minha tela"><label>Posição vertical<select disabled={previewing} value={displayOverride.position ?? ""} onChange={(e) => setDisplayOverride("position", e.target.value as "" | MarkerDisplayLayout["position"])}><option value="">Usar meu padrão</option><option value="TOP">Acima</option><option value="BOTTOM">Abaixo</option></select></label><label>Alinhamento<select disabled={previewing} value={displayOverride.horizontal ?? ""} onChange={(e) => setDisplayOverride("horizontal", e.target.value as "" | MarkerDisplayLayout["horizontal"])}><option value="">Usar meu padrão</option><option value="LEFT">Esquerda</option><option value="CENTER">Centro</option><option value="RIGHT">Direita</option></select></label><label>Tamanho<select disabled={previewing} value={displayOverride.size ?? ""} onChange={(e) => setDisplayOverride("size", e.target.value as "" | MarkerDisplayLayout["size"])}><option value="">Usar meu padrão</option><option value="SMALL">Pequeno</option><option value="MEDIUM">Médio</option><option value="LARGE">Grande</option></select></label></div></details>
      {gm && <details className="admin-actions"><summary>Ordem, acesso e marcadores</summary><div className="button-row"><button className="button" disabled={readOnly || index === 0} onClick={() => move(-1)}>↑ Subir na ordem</button><button className="button" disabled={readOnly || index === state.encounter.order.length - 1} onClick={() => move(1)}>↓ Descer na ordem</button>{!state.activeTokenId && <button className="button" disabled={readOnly} onClick={() => void command({ type: "start", tokenId: c.tokenId })}>▶ Iniciar turno aqui</button>}<button className="button" onClick={() => setModal("access")}>⚙ Acesso</button><button className="button" onClick={() => setModal("markers")}>◫ Marcadores</button><button className="button danger subtle" disabled={readOnly} onClick={() => { if (confirm(`Remover ${token?.name ?? "este combatente"} da Rulebear?`)) void command({ type: "remove", tokenId: c.tokenId }); }}>Excluir combatente</button></div></details>}
    </section>}
    {modal === "access" && gm && expanded && <AccessEditor combatant={c} onClose={() => setModal(null)} />}
    {modal === "markers" && gm && expanded && <MarkerEditor combatant={c} onClose={() => setModal(null)} />}
    {modal === "defenses" && expanded && allowed(c.settings.visibility.defenses, c, viewer) && <Dialog title="Defesas do token" onClose={() => setModal(null)}>{gm ? <fieldset disabled={readOnly} className="dialog-guard"><ReductionEditor state={state} combatant={c} onDone={() => setModal(null)} /></fieldset> : c.reductions.length ? <div className="readonly-defenses">{c.reductions.map((r, index) => <article className="defense-card compact" key={r.id}><strong>{index + 1}. {r.label}</strong><span>{r.kind === "IMMUNITY" ? "Imunidade" : `RD ${r.amount}`}</span><div className="mini-chips">{r.damageTypeIds.length ? r.damageTypeIds.map((typeId) => <span key={typeId}>{state.damageTypes.find((type) => type.id === typeId)?.name ?? "Tipo"}</span>) : <span>Universal</span>}</div></article>)}</div> : <div className="empty-inline"><strong>Sem defesas</strong><span>O mestre ainda não configurou defesas para este token.</span></div>}</Dialog>}
  </article>;
}

function HealthEditor({ combatant: c, viewer, disabled }: { combatant: CombatantState; viewer: Viewer; disabled: boolean }) {
  const canDamage = permitted(c, viewer, "damage"), canHeal = permitted(c, viewer, "heal");
  const canAdjustCurrent = permitted(c, viewer, "adjustCurrentHp"), canAdjustMaximum = permitted(c, viewer, "adjustMaximumHp");
  const [value, setValue] = useState(""), [typeId, setTypeId] = useState("");
  const [current, setCurrent] = useState(""), [maximumValue, setMaximumValue] = useState("");
  const [components, setComponents] = useState<DamageComponent[]>([blankDamageComponent()]);
  const command = useAppStore((s) => s.command), types = useAppStore((s) => s.state.damageTypes);
  const input = useRef<HTMLInputElement>(null);
  const amount = value.trim(), healable = /^\d+$/.test(amount) && Number(amount) > 0;
  // Mantém o foco no campo para encadear vários valores seguidos.
  const done = (ok: boolean) => { if (ok) setValue(""); input.current?.focus(); };
  const damage = () => { if (!disabled && canDamage && amount) void command({ type: "damage", tokenId: c.tokenId, components: [{ expression: amount, damageTypeIds: typeId ? [typeId] : [], ignoreImmunity: false }] }).then(done); };
  const heal = () => { if (!disabled && canHeal && healable) void command({ type: "heal", tokenId: c.tokenId, amount: Number(amount) }).then(done); };
  return <div className="context-editor hp-editor">
    {(canDamage || canHeal) && <form className="hp-quick" onSubmit={(e) => { e.preventDefault(); if (canDamage) damage(); else heal(); }}>
      <div className="hp-quick-row"><input ref={input} autoFocus aria-label="Valor de HP" autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && e.shiftKey) { e.preventDefault(); heal(); } }} placeholder={canDamage ? "7 ou 2d6+3" : "Valor"} />{canDamage && <select aria-label="Tipo de dano" value={typeId} onChange={(e) => setTypeId(e.target.value)}><option value="">Sem tipo</option>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select>}</div>
      <div className="hp-quick-actions">{canDamage && <button className="button damage-action" aria-label="Aplicar dano" disabled={disabled || !amount}>− Dano</button>}{canHeal && <button type="button" className="button heal-action" aria-label="Aplicar cura" disabled={disabled || !healable} onClick={heal}>+ Cura</button>}</div>
      <small className="field-help">{canDamage && canHeal ? "Enter aplica dano · Shift+Enter aplica cura." : canDamage ? "Enter aplica dano. Aceita dados, como 2d6+3." : "Enter aplica cura. Use um número inteiro."}</small>
    </form>}
    {canDamage && <details className="hp-more"><summary>Dano avançado · vários tipos, imunidade e RD</summary><form className="form-stack" onSubmit={(e) => {
      e.preventDefault(); if (!disabled) void command({ type: "damage", tokenId: c.tokenId, components }).then((ok) => { if (ok) setComponents([blankDamageComponent()]); });
    }}><DamageComponentRows types={types} components={components} onChange={setComponents} disabled={disabled} /><button className="button primary" disabled={disabled || components.some((component) => !component.expression.trim())}>Aplicar dano avançado</button></form></details>}
    {(canAdjustCurrent || canAdjustMaximum) && <details className="hp-more" open={!canDamage && !canHeal}><summary>Ajustar HP atual ou máximo</summary><div className="hp-adjust-grid">
      {canAdjustCurrent && <form className="quick-form" onSubmit={(e) => { e.preventDefault(); if (!disabled && current.trim()) void command({ type: "hpAdjust", tokenId: c.tokenId, target: "CURRENT", expression: current }).then((ok) => { if (ok) setCurrent(""); }); }}><label>Ajustar HP atual<input value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="=10, +2, -3…" /></label><button className="button primary" disabled={disabled || !current.trim()}>Aplicar</button></form>}
      {canAdjustMaximum && <form className="quick-form" onSubmit={(e) => { e.preventDefault(); if (!disabled && maximumValue.trim()) void command({ type: "hpAdjust", tokenId: c.tokenId, target: "MAXIMUM", expression: maximumValue }).then((ok) => { if (ok) setMaximumValue(""); }); }}><label>Ajustar HP máximo<input value={maximumValue} onChange={(e) => setMaximumValue(e.target.value)} placeholder="=20, +5, /2…" /></label><button className="button primary" disabled={disabled || !maximumValue.trim()}>Aplicar</button></form>}
    </div></details>}
  </div>;
}
function ValueEditor({ marker: m, combatant: c, disabled }: { marker: Marker; combatant: CombatantState; disabled: boolean }) {
  const [expression, setExpression] = useState(""); const command = useAppStore((s) => s.command);
  if (m.kind === "checkbox") return <label className="check"><input type="checkbox" checked={m.checked} disabled={disabled} onChange={(e) => void command({ type: "markerValue", tokenId: c.tokenId, markerId: m.id, checked: e.target.checked })} />{m.name}</label>;
  const adjust = (value: string) => command({ type: "markerValue", tokenId: c.tokenId, markerId: m.id, expression: value });
  return <form className="quick-form context-editor" onSubmit={(e) => { e.preventDefault(); if (!disabled) void adjust(expression).then((ok) => { if (ok) setExpression(""); }); }}><label>Ajustar {m.name}<input value={expression} onChange={(e) => setExpression(e.target.value)} placeholder="=10, +2, -3…" /></label>{m.kind === "counter" && <div className="counter-controls"><button type="button" aria-label={`Diminuir ${m.name}`} disabled={disabled} onClick={() => void adjust("-1")}>−</button><button type="button" aria-label={`Aumentar ${m.name}`} disabled={disabled} onClick={() => void adjust("+1")}>+</button></div>}<button className="button" disabled={disabled || !expression.trim()}>Aplicar</button></form>;
}
function InitiativeInput({ combatant: c, showValue, disabled, onCancel, onSaved }: { combatant: CombatantState; showValue: boolean; disabled: boolean; onCancel(): void; onSaved(): void }) {
  const initial = showValue && c.initiative !== null ? String(c.initiative) : "";
  const [value, setValue] = useState(initial);
  const command = useAppStore((s) => s.command); const [revision] = useState(() => useAppStore.getState().state.revision);
  const save = () => {
    if (disabled) return;
    if (value.trim() === initial) { onSaved(); return; }
    void command({ type: "initiative", tokenId: c.tokenId, value: value.trim() ? Number(value) : null }, revision).then((ok) => { if (ok) onSaved(); });
  };
  // readOnly em vez de disabled: desabilitar o campo focado o tiraria da edição no meio do salvamento.
  return <input className="initiative-input" type="number" step="any" autoFocus aria-label="Iniciativa" title="Enter ou Tab salva e passa ao próximo · Esc cancela" value={value} readOnly={disabled} onFocus={(e) => e.target.select()} onChange={(e) => setValue(e.target.value)} onBlur={onCancel} onKeyDown={(e) => {
    if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) { e.preventDefault(); save(); }
    if (e.key === "Escape") { e.stopPropagation(); onCancel(); }
  }} />;
}
