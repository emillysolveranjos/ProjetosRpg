import { useState, type FormEvent } from "react";
import type { CombatantState, ConditionDefinition, DamageReduction, RulebearSceneState, Trigger } from "../domain/types";
import { useAppStore } from "../state/store";
import { Dialog } from "./Shared";
const id = () => crypto.randomUUID();
const reportError = (error: unknown) => useAppStore.setState({ error: error instanceof Error ? error.message : "Algo deu errado." });
export function ReductionEditor({ combatant, onDone }: { state: RulebearSceneState; combatant: CombatantState; onDone(): void }) {
  const [revision] = useState(useAppStore.getState().state.revision);
  const [rows, setRows] = useState(() => combatant.reductions.map((row) => ({ ...row, categoriesText: row.categories.join(", ") })));
  function save(event: FormEvent) {
    event.preventDefault();
    const reductions: DamageReduction[] = rows.map(({ categoriesText, ...row }) => ({ ...row, amount: Number(row.amount), categories: categoriesText.split(",") }));
    void useAppStore.getState().command({ type: "reductions", tokenId: combatant.tokenId, reductions }, revision).then((saved) => { if (saved) onDone(); });
  }
  return <form className="reduction-editor" onSubmit={save}><span className="kicker">REDUÇÕES EM ORDEM</span>{rows.map((row, index) => <div className="reduction-row" key={row.id}><input aria-label="Nome da redução" value={row.label} onChange={(event) => setRows(rows.map((item, position) => position === index ? { ...item, label: event.target.value } : item))} placeholder="Armadura" /><input aria-label="Valor da redução" className="number" inputMode="numeric" value={row.amount} onChange={(event) => setRows(rows.map((item, position) => position === index ? { ...item, amount: Number(event.target.value) } : item))} /><input aria-label="Categorias" value={row.categoriesText} onChange={(event) => setRows(rows.map((item, position) => position === index ? { ...item, categoriesText: event.target.value } : item))} placeholder="físico" /><button type="button" onClick={() => setRows(rows.filter((_, position) => position !== index))}>×</button></div>)}<div className="editor-actions"><button type="button" className="text-button" onClick={() => setRows([...rows, { id: id(), label: "", amount: 0, categories: [], categoriesText: "" }])}>+ Redução</button><button className="button">Salvar</button></div></form>;
}

export function ConditionLibrary({ state, onClose }: { state: RulebearSceneState; onClose(): void }) {
  const readonly = useAppStore((store) => !store.online || store.busy);
  const blank = (): ConditionDefinition => ({ id: id(), name: "", maximumStacks: 1, effects: [] });
  const [draft, setDraft] = useState<ConditionDefinition>(blank);
  const [hasEffect, setHasEffect] = useState(false);
  const [kind, setKind] = useState<"DAMAGE" | "HEAL">("DAMAGE");
  const [trigger, setTrigger] = useState<Trigger>("TURN_START");
  const [expression, setExpression] = useState("1");
  const [duration, setDuration] = useState("");

  function edit(definition: ConditionDefinition) {
    setDraft(structuredClone(definition));
    const effect = definition.effects[0];
    setHasEffect(Boolean(effect));
    if (effect) { setKind(effect.kind); setTrigger(effect.trigger); setExpression(effect.expression); }
    setDuration(definition.duration ? String(definition.duration.ticks) : "");
  }
  function save(event: FormEvent) {
    event.preventDefault();
    const definition: ConditionDefinition = {
      ...draft,
      maximumStacks: Number(draft.maximumStacks),
      ...(duration ? { duration: { ticks: Number(duration), decrementOn: trigger } } : {}),
      effects: hasEffect ? [{ id: draft.effects[0]?.id ?? id(), kind, trigger, expression, categories: [], multiplyByStacks: true, bypassReductions: false }] : [],
    };
    if (!duration) delete definition.duration;
    void useAppStore.getState().command({ type: "saveDefinition", definition }).then((saved) => { if (saved) { setDraft(blank()); setHasEffect(false); setDuration(""); } });
  }
  return <Dialog title="Biblioteca de condições" onClose={onClose} wide>
    <div className="definition-list">{state.conditionDefinitions.length === 0 ? <p>Nenhuma condição criada nesta cena.</p> : state.conditionDefinitions.map((definition) => <div key={definition.id}><button className="definition-name" onClick={() => edit(definition)}><strong>{definition.name}</strong><small>{definition.maximumStacks} stack(s){definition.duration ? ` · ${definition.duration.ticks} turno(s)` : ""}</small></button><button disabled={readonly} title="Excluir" onClick={() => { try { void useAppStore.getState().command({ type: "deleteDefinition", definitionId: definition.id }); } catch (error) { reportError(error); } }}>×</button></div>)}</div>
    <form className="form-stack condition-form" onSubmit={save}><span className="kicker">{state.conditionDefinitions.some((item) => item.id === draft.id) ? "EDITAR" : "NOVA CONDIÇÃO"}</span><label>Nome<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Envenenado" /></label><div className="form-grid"><label>Máx. stacks<input inputMode="numeric" value={draft.maximumStacks} onChange={(event) => setDraft({ ...draft, maximumStacks: Number(event.target.value) })} /></label><label>Duração em turnos<input inputMode="numeric" value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="Sem duração" /></label></div><label className="check"><input type="checkbox" checked={hasEffect} onChange={(event) => setHasEffect(event.target.checked)} /> Executar efeito automático</label>{hasEffect && <div className="effect-grid"><select aria-label="Tipo do efeito" value={kind} onChange={(event) => setKind(event.target.value as "DAMAGE" | "HEAL")}><option value="DAMAGE">Dano</option><option value="HEAL">Cura</option></select><select aria-label="Momento do efeito" value={trigger} onChange={(event) => setTrigger(event.target.value as Trigger)}><option value="TURN_START">Início do turno</option><option value="TURN_END">Fim do turno</option></select><input aria-label="Valor do efeito" value={expression} onChange={(event) => setExpression(event.target.value)} placeholder="1d6" /></div>}<div className="dialog-actions"><button type="button" className="button" onClick={() => { setDraft(blank()); setHasEffect(false); }}>Limpar</button><button disabled={readonly} className="button primary">Salvar condição</button></div></form>
  </Dialog>;
}
