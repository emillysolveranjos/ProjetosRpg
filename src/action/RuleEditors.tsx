import { useState, type FormEvent } from "react";
import { damageTypeUsage } from "../domain/engine";
import type { CombatantState, ConditionDefinition, DamageReduction, DamageTypeDefinition, DefensePreset, RulebearSceneState, Trigger } from "../domain/types";
import { useAppStore } from "../state/store";
import { Dialog } from "./Shared";

const id = () => crypto.randomUUID();

export function DamageTypeChecks({ types, selected, onChange, disabled = false, label = "Tipos de dano" }: {
  types: DamageTypeDefinition[]; selected: string[]; onChange(value: string[]): void; disabled?: boolean; label?: string;
}) {
  const toggle = (typeId: string) => onChange(selected.includes(typeId) ? selected.filter((value) => value !== typeId) : selected.length < 12 ? [...selected, typeId] : selected);
  return <fieldset className="damage-type-picker" disabled={disabled}><legend>{label}</legend><div className="damage-type-chips">
    {types.map((type) => <button key={type.id} type="button" className="damage-type-chip" aria-pressed={selected.includes(type.id)} onClick={() => toggle(type.id)} title={type.description}>
      <span style={{ backgroundColor: type.color }} />{type.name}
    </button>)}
    {!types.length && <small className="muted">Crie tipos na Biblioteca.</small>}
  </div><small className="field-help">Nenhum tipo selecionado significa dano sem tipo. Escolha até 12.</small></fieldset>;
}

export function ReductionEditor({ state, combatant, onDone }: { state: RulebearSceneState; combatant: CombatantState; onDone(): void }) {
  const [revision, setRevision] = useState(useAppStore.getState().state.revision);
  const [rows, setRows] = useState<DamageReduction[]>(() => structuredClone(combatant.reductions));
  const [presetId, setPresetId] = useState("");
  const readonly = useAppStore((store) => !store.online || store.busy);
  const update = (index: number, patch: Partial<DamageReduction>) => setRows(rows.map((row, position) => position === index ? { ...row, ...patch } : row));
  const move = (index: number, delta: number) => { const next = [...rows]; const [row] = next.splice(index, 1); next.splice(index + delta, 0, row!); setRows(next); };
  function save(event: FormEvent) {
    event.preventDefault();
    void useAppStore.getState().command({ type: "reductions", tokenId: combatant.tokenId, reductions: rows.map((row) => ({ ...row, amount: Number(row.amount) })) }, revision).then((saved) => { if (saved) onDone(); });
  }
  return <form className="reduction-editor form-stack" onSubmit={save}>
    <section className="preset-apply"><div><h3>Adicionar um preset</h3><p className="muted">Uma cópia independente será adicionada ao token.</p></div><div className="inline-action"><select aria-label="Preset de defesa" value={presetId} onChange={(event) => setPresetId(event.target.value)}><option value="">Escolher preset…</option>{state.defensePresets.map((preset) => <option value={preset.id} key={preset.id}>{preset.name} · −{preset.amount}</option>)}</select><button type="button" className="button primary" disabled={readonly || !presetId} onClick={() => void useAppStore.getState().command({ type: "applyDefensePreset", tokenId: combatant.tokenId, presetId }).then((saved) => { if (saved) onDone(); })}>Adicionar ao token</button></div></section>
    <div className="section-heading"><div><span className="kicker">DEFESAS DO TOKEN</span><h3>Reduções em ordem</h3></div><p>O dano passa pelos cartões de cima para baixo. Uma defesa universal não seleciona tipos.</p></div>
    {!rows.length && <div className="empty-inline"><strong>Nenhuma defesa configurada</strong><span>Crie uma redução manual ou adicione um preset.</span></div>}
    {rows.map((row, index) => <fieldset className="defense-card" key={row.id}><legend>{row.label.trim() || `Defesa ${index + 1}`}</legend>
      <div className="form-grid"><label>Nome<input aria-label="Nome da redução" value={row.label} onChange={(event) => update(index, { label: event.target.value })} placeholder="Armadura" /></label><label>Redução fixa<input aria-label="Valor da redução" inputMode="numeric" value={row.amount} onChange={(event) => update(index, { amount: Number(event.target.value) })} /></label></div>
      <DamageTypeChecks types={state.damageTypes} selected={row.damageTypeIds} onChange={(damageTypeIds) => update(index, { damageTypeIds })} label="Afeta estes tipos" />
      <div className="defense-actions"><button type="button" className="button" disabled={index === 0} onClick={() => move(index, -1)}>↑ Subir</button><button type="button" className="button" disabled={index === rows.length - 1} onClick={() => move(index, 1)}>↓ Descer</button><button type="button" className="button" disabled={readonly || !row.label.trim()} onClick={() => void useAppStore.getState().command({ type: "saveDefensePreset", preset: { id: id(), name: row.label, amount: Number(row.amount), damageTypeIds: row.damageTypeIds } }).then((saved) => { if (saved) setRevision(useAppStore.getState().state.revision); })}>☆ Salvar como preset</button><button type="button" className="button danger subtle" onClick={() => setRows(rows.filter((_, position) => position !== index))}>Excluir</button></div>
    </fieldset>)}
    <div className="editor-actions"><button type="button" className="button" onClick={() => setRows([...rows, { id: id(), label: "", amount: 0, damageTypeIds: [] }])}>＋ Nova defesa manual</button><button className="button primary" disabled={readonly}>Salvar defesas</button></div>
  </form>;
}

type LibraryTab = "conditions" | "damage" | "defenses";
export function LibraryDialog({ state, onClose }: { state: RulebearSceneState; onClose(): void }) {
  const [tab, setTab] = useState<LibraryTab>("conditions");
  return <Dialog title="Biblioteca da cena" onClose={onClose} wide><nav className="library-tabs" aria-label="Seções da biblioteca">
    <button aria-current={tab === "conditions" ? "page" : undefined} onClick={() => setTab("conditions")}><span>◈</span>Condições <b>{state.conditionDefinitions.length}</b></button>
    <button aria-current={tab === "damage" ? "page" : undefined} onClick={() => setTab("damage")}><span>✦</span>Tipos de dano <b>{state.damageTypes.length}</b></button>
    <button aria-current={tab === "defenses" ? "page" : undefined} onClick={() => setTab("defenses")}><span>◆</span>Presets de defesa <b>{state.defensePresets.length}</b></button>
  </nav>{tab === "conditions" ? <ConditionSection state={state} /> : tab === "damage" ? <DamageTypeSection state={state} /> : <DefensePresetSection state={state} />}</Dialog>;
}

function ConditionSection({ state }: { state: RulebearSceneState }) {
  const readonly = useAppStore((store) => !store.online || store.busy);
  const blank = (): ConditionDefinition => ({ id: id(), name: "", maximumStacks: 1, effects: [] });
  const [draft, setDraft] = useState<ConditionDefinition>(blank);
  const [hasEffect, setHasEffect] = useState(false);
  const [kind, setKind] = useState<"DAMAGE" | "HEAL">("DAMAGE");
  const [trigger, setTrigger] = useState<Trigger>("TURN_START");
  const [expression, setExpression] = useState("1");
  const [duration, setDuration] = useState("");
  const [damageTypeIds, setDamageTypeIds] = useState<string[]>([]);
  const [bypass, setBypass] = useState(false);
  function reset() { setDraft(blank()); setHasEffect(false); setDuration(""); setDamageTypeIds([]); setBypass(false); }
  function edit(definition: ConditionDefinition) {
    setDraft(structuredClone(definition)); const effect = definition.effects[0]; setHasEffect(Boolean(effect));
    if (effect) { setKind(effect.kind); setTrigger(effect.trigger); setExpression(effect.expression); setDamageTypeIds(effect.damageTypeIds); setBypass(effect.bypassReductions); }
    else { setDamageTypeIds([]); setBypass(false); }
    setDuration(definition.duration ? String(definition.duration.ticks) : "");
  }
  function save(event: FormEvent) {
    event.preventDefault();
    const definition: ConditionDefinition = { ...draft, maximumStacks: Number(draft.maximumStacks), ...(duration ? { duration: { ticks: Number(duration), decrementOn: trigger } } : {}), effects: hasEffect ? [{ id: draft.effects[0]?.id ?? id(), kind, trigger, expression, damageTypeIds: kind === "DAMAGE" ? damageTypeIds : [], multiplyByStacks: true, bypassReductions: kind === "DAMAGE" && bypass }] : [] };
    if (!duration) delete definition.duration;
    void useAppStore.getState().command({ type: "saveDefinition", definition }).then((saved) => { if (saved) reset(); });
  }
  return <section className="library-section"><header className="section-heading"><div><span className="kicker">CONDIÇÕES</span><h3>Efeitos reutilizáveis</h3></div><p>Crie condições, duração e efeitos automáticos de dano ou cura.</p></header>
    <div className="definition-list">{!state.conditionDefinitions.length ? <div className="empty-inline"><strong>Nenhuma condição</strong><span>Use o formulário abaixo para criar a primeira.</span></div> : state.conditionDefinitions.map((definition) => <div key={definition.id}><button className="definition-name" onClick={() => edit(definition)}><strong>{definition.name}</strong><small>{definition.maximumStacks} stack(s){definition.duration ? ` · ${definition.duration.ticks} turno(s)` : ""}</small></button><button className="danger-icon" disabled={readonly} aria-label={`Excluir ${definition.name}`} onClick={() => { if (confirm(`Excluir a condição “${definition.name}”?`)) void useAppStore.getState().command({ type: "deleteDefinition", definitionId: definition.id }); }}>×</button></div>)}</div>
    <form className="form-stack condition-form" onSubmit={save}><span className="kicker">{state.conditionDefinitions.some((item) => item.id === draft.id) ? "EDITAR CONDIÇÃO" : "NOVA CONDIÇÃO"}</span><label>Nome<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Envenenado" /></label><div className="form-grid"><label>Máx. stacks<input inputMode="numeric" value={draft.maximumStacks} onChange={(event) => setDraft({ ...draft, maximumStacks: Number(event.target.value) })} /></label><label>Duração em turnos<input inputMode="numeric" value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="Sem duração" /></label></div><label className="check"><input type="checkbox" checked={hasEffect} onChange={(event) => setHasEffect(event.target.checked)} /> Executar efeito automático</label>{hasEffect && <div className="form-stack"><div className="effect-grid"><select aria-label="Tipo do efeito" value={kind} onChange={(event) => setKind(event.target.value as "DAMAGE" | "HEAL")}><option value="DAMAGE">Dano</option><option value="HEAL">Cura</option></select><select aria-label="Momento do efeito" value={trigger} onChange={(event) => setTrigger(event.target.value as Trigger)}><option value="TURN_START">Início do turno</option><option value="TURN_END">Fim do turno</option></select><input aria-label="Valor do efeito" value={expression} onChange={(event) => setExpression(event.target.value)} placeholder="1d6" /></div>{kind === "DAMAGE" && <><DamageTypeChecks types={state.damageTypes} selected={damageTypeIds} onChange={setDamageTypeIds} /><label className="check"><input type="checkbox" checked={bypass} onChange={(event) => setBypass(event.target.checked)} /> Ignorar defesas do token</label></>}</div>}<div className="dialog-actions"><button type="button" className="button" onClick={reset}>Limpar</button><button disabled={readonly} className="button primary">Salvar condição</button></div></form>
  </section>;
}

function DamageTypeSection({ state }: { state: RulebearSceneState }) {
  const readonly = useAppStore((store) => !store.online || store.busy);
  const blank = (): DamageTypeDefinition => ({ id: id(), name: "", color: "#64748b" });
  const [draft, setDraft] = useState<DamageTypeDefinition>(blank);
  const editing = state.damageTypes.some((item) => item.id === draft.id);
  const save = (event: FormEvent) => { event.preventDefault(); void useAppStore.getState().command({ type: "saveDamageType", definition: draft }).then((ok) => { if (ok) setDraft(blank()); }); };
  return <section className="library-section"><header className="section-heading"><div><span className="kicker">TIPOS DE DANO</span><h3>Classifique ataques e defesas</h3></div><p>As cores identificam os tipos nos formulários. Nomes duplicados ignoram acentos e maiúsculas.</p></header><div className="library-card-list">{state.damageTypes.map((type) => { const usage = damageTypeUsage(state, type.id); const total = usage.defenses + usage.conditions + usage.presets; return <article className="library-card" key={type.id}><span className="type-swatch" style={{ backgroundColor: type.color }} /><div><strong>{type.name}</strong><small>{type.description || "Sem descrição"}</small><span className="usage-label">{total ? `${total} uso(s) · ${usage.presets} preset(s), ${usage.defenses} defesa(s), ${usage.conditions} condição(ões)` : "Ainda não usado"}</span></div><div className="card-menu"><button className="button" onClick={() => setDraft(structuredClone(type))}>Editar</button><button className="button danger subtle" disabled={readonly} onClick={() => { if (confirm(`Excluir o tipo de dano “${type.name}”?`)) void useAppStore.getState().command({ type: "deleteDamageType", damageTypeId: type.id }); }}>Excluir</button></div></article>; })}</div>
    <form className="library-form form-stack" onSubmit={save}><span className="kicker">{editing ? "EDITAR TIPO" : "NOVO TIPO"}</span><div className="form-grid"><label>Nome<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Radiante" /></label><label>Cor<input type="color" value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} /></label></div><label>Descrição opcional<textarea value={draft.description ?? ""} onChange={(event) => setDraft({ ...draft, description: event.target.value })} maxLength={240} placeholder="Quando este tipo deve ser usado" /></label><div className="dialog-actions"><button type="button" className="button" onClick={() => setDraft(blank())}>Limpar</button><button disabled={readonly} className="button primary">Salvar tipo</button></div></form>
  </section>;
}

function DefensePresetSection({ state }: { state: RulebearSceneState }) {
  const readonly = useAppStore((store) => !store.online || store.busy);
  const blank = (): DefensePreset => ({ id: id(), name: "", amount: 0, damageTypeIds: [] });
  const [draft, setDraft] = useState<DefensePreset>(blank);
  const editing = state.defensePresets.some((item) => item.id === draft.id);
  const save = (event: FormEvent) => { event.preventDefault(); void useAppStore.getState().command({ type: "saveDefensePreset", preset: { ...draft, amount: Number(draft.amount) } }).then((ok) => { if (ok) setDraft(blank()); }); };
  const typeName = (typeId: string) => state.damageTypes.find((type) => type.id === typeId)?.name ?? "Tipo removido";
  return <section className="library-section"><header className="section-heading"><div><span className="kicker">PRESETS DE DEFESA</span><h3>Reduções prontas para copiar</h3></div><p>Aplicar um preset cria uma cópia no token. Alterações futuras no preset não mudam a cópia.</p></header><div className="library-card-list">{!state.defensePresets.length && <div className="empty-inline"><strong>Nenhum preset</strong><span>Crie um abaixo ou salve uma defesa de token como preset.</span></div>}{state.defensePresets.map((preset) => <article className="library-card" key={preset.id}><span className="preset-badge">−{preset.amount}</span><div><strong>{preset.name}</strong><div className="mini-chips">{preset.damageTypeIds.length ? preset.damageTypeIds.map((typeId) => <span key={typeId}>{typeName(typeId)}</span>) : <span>Universal</span>}</div></div><div className="card-menu"><button className="button" onClick={() => setDraft(structuredClone(preset))}>Editar</button><button className="button danger subtle" disabled={readonly} onClick={() => { if (confirm(`Excluir o preset de defesa “${preset.name}”?`)) void useAppStore.getState().command({ type: "deleteDefensePreset", presetId: preset.id }); }}>Excluir</button></div></article>)}</div>
    <form className="library-form form-stack" onSubmit={save}><span className="kicker">{editing ? "EDITAR PRESET" : "NOVO PRESET"}</span><div className="form-grid"><label>Nome<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Armadura pesada" /></label><label>Redução fixa<input inputMode="numeric" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: Number(event.target.value) })} /></label></div><DamageTypeChecks types={state.damageTypes} selected={draft.damageTypeIds} onChange={(damageTypeIds) => setDraft({ ...draft, damageTypeIds })} label="Afeta estes tipos" /><div className="dialog-actions"><button type="button" className="button" onClick={() => setDraft(blank())}>Limpar</button><button disabled={readonly} className="button primary">Salvar preset</button></div></form>
  </section>;
}

export const ConditionLibrary = LibraryDialog;
