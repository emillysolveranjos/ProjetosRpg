import { useEffect, useState, type FormEvent } from "react";
import {
  addCombatant,
  applyCondition,
  applyDamage,
  applyHealing,
  changeConditionStacks,
  deleteConditionDefinition,
  processTurn,
  removeCombatant,
  removeCondition,
  saveConditionDefinition,
  setReductions,
  undoLastAction,
} from "../domain/engine";
import type { CombatantState, ConditionDefinition, DamageReduction, RulebearSceneState, TokenView, Trigger } from "../domain/types";
import type { OwlbearGateway } from "../owlbear/gateway";
import { useAppStore } from "../state/store";

const id = () => crypto.randomUUID();
const reportError = (error: unknown) => useAppStore.setState({ error: error instanceof Error ? error.message : "Algo deu errado.", notice: undefined });

export function App({ gateway }: { gateway?: OwlbearGateway }) {
  const { status, state, tokens, pendingTokenId, error, notice, initialize, setPendingToken } = useAppStore();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    let disposed = false;
    let cleanup: () => void = () => {};
    void initialize(gateway).then((unsubscribe) => {
      if (disposed) unsubscribe();
      else cleanup = unsubscribe;
    });
    return () => { disposed = true; cleanup(); };
  }, [gateway, initialize]);

  const pendingToken = pendingTokenId ? tokens.find((token) => token.id === pendingTokenId) : undefined;

  if (status === "LOADING") return <Centered eyebrow="RULEBEAR" title="Abrindo a ficha da cena…" />;
  if (status === "OUTSIDE") return <Outside />;
  if (status === "NO_SCENE") return <Centered eyebrow="SEM CENA" title="Abra uma cena para começar" detail="A Rulebear guarda cada encontro dentro da própria cena do Owlbear Rodeo." />;
  if (status === "PLAYER") return <Centered eyebrow="ÁREA DO GM" title="Esta ferramenta é privada" detail="Somente o GM pode consultar ou alterar os combatentes da Rulebear." />;
  if (status === "INVALID") return <Centered eyebrow="METADATA INVÁLIDA" title="A cena precisa de atenção" detail={error} />;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">R</div>
        <div className="brand-copy"><span>RULEBEAR</span><strong>Mesa do GM</strong></div>
        <button className="icon-button" title="Desfazer última ação" disabled={!state.undo} onClick={() => void commit(() => undoLastAction(state), "Última ação desfeita.")}>↶</button>
        <button className="icon-button" title="Histórico" onClick={() => setHistoryOpen(true)}>≡</button>
      </header>

      <section className="scene-summary">
        <div><span className="kicker">ENCONTRO ATUAL</span><h1>{Object.keys(state.combatants).length} combatente{Object.keys(state.combatants).length === 1 ? "" : "s"}</h1></div>
        <button className="button primary" onClick={() => void useAppStore.getState().requestSelectedToken()}>+ Token selecionado</button>
      </section>

      {(error || notice) && <div className={`flash ${error ? "error" : "notice"}`} role="status"><span>{error ?? notice}</span><button onClick={() => useAppStore.getState().clearMessage()}>×</button></div>}

      <section className="roster" aria-label="Combatentes">
        {Object.keys(state.combatants).length === 0 ? (
          <div className="empty-card"><span className="empty-glyph">◇</span><h2>Ninguém no encontro</h2><p>Selecione um token de personagem no mapa e adicione-o à Rulebear.</p></div>
        ) : Object.values(state.combatants).map((combatant) => (
          <CombatantCard key={combatant.tokenId} combatant={combatant} token={tokens.find((token) => token.id === combatant.tokenId)} state={state} />
        ))}
      </section>

      <footer className="footer-bar">
        <span>rev. {state.revision}</span>
        <button className="text-button" onClick={() => setLibraryOpen(true)}>Condições <b>{state.conditionDefinitions.length}</b></button>
        <button className="text-button" onClick={() => setHistoryOpen(true)}>Histórico <b>{state.history.length}</b></button>
      </footer>

      {pendingTokenId && <AddCombatantDialog token={pendingToken} onClose={() => setPendingToken()} />}
      {libraryOpen && <ConditionLibrary state={state} onClose={() => setLibraryOpen(false)} />}
      {historyOpen && <HistoryPanel state={state} tokens={tokens} onClose={() => setHistoryOpen(false)} />}
    </main>
  );
}

async function commit(transform: () => RulebearSceneState, notice?: string): Promise<boolean> {
  try { await useAppStore.getState().persist(transform(), notice); return true; }
  catch (error) { reportError(error); return false; }
}

function Centered({ eyebrow, title, detail }: { eyebrow: string; title: string; detail?: string }) {
  return <main className="centered-state"><div className="brand-mark large">R</div><span className="kicker">{eyebrow}</span><h1>{title}</h1>{detail && <p>{detail}</p>}</main>;
}

function Outside() {
  return <main className="outside"><div className="brand-mark large">R</div><span className="kicker">EXTENSÃO OWLBEAR RODEO</span><h1>Rulebear vive dentro da sua mesa.</h1><p>Abra o Owlbear Rodeo, instale o manifesto da extensão e use o botão Rulebear na barra da sala.</p><a className="button primary" href="https://www.owlbear.rodeo" target="_blank" rel="noreferrer">Abrir Owlbear Rodeo</a></main>;
}

function AddCombatantDialog({ token, onClose }: { token?: TokenView; onClose(): void }) {
  const state = useAppStore((store) => store.state);
  const [maximumHp, setMaximumHp] = useState("20");
  const [currentHp, setCurrentHp] = useState("20");
  if (!token) return <Dialog title="Token indisponível" onClose={onClose}><p>Este token não existe mais na cena.</p></Dialog>;
  const selectedToken = token;

  function submit(event: FormEvent) {
    event.preventDefault();
    void commit(() => addCombatant(state, selectedToken.id, Number(currentHp), Number(maximumHp)), `${selectedToken.name} entrou no encontro.`).then((saved) => { if (saved) onClose(); });
  }
  return <Dialog title="Adicionar combatente" onClose={onClose}>
    <div className="token-heading"><TokenPortrait token={selectedToken} /><div><span className="kicker">TOKEN DA CENA</span><strong>{selectedToken.name}</strong></div></div>
    <form onSubmit={submit} className="form-stack">
      <label>HP máximo<input autoFocus inputMode="numeric" value={maximumHp} onChange={(event) => { setMaximumHp(event.target.value); if (currentHp === maximumHp) setCurrentHp(event.target.value); }} /></label>
      <label>HP atual<input inputMode="numeric" value={currentHp} onChange={(event) => setCurrentHp(event.target.value)} /></label>
      <div className="dialog-actions"><button type="button" className="button" onClick={onClose}>Cancelar</button><button className="button primary">Adicionar</button></div>
    </form>
  </Dialog>;
}

function CombatantCard({ combatant, token, state }: { combatant: CombatantState; token?: TokenView; state: RulebearSceneState }) {
  const [panel, setPanel] = useState<"damage" | "heal" | "defense" | null>(null);
  const [expression, setExpression] = useState("1d6");
  const [categories, setCategories] = useState("");
  const [bypass, setBypass] = useState(false);
  const [heal, setHeal] = useState("1");
  const [conditionId, setConditionId] = useState("");
  const active = state.activeTokenId === combatant.tokenId;
  const hpPercent = Math.round((combatant.currentHp / combatant.maximumHp) * 100);

  function damage(event: FormEvent) {
    event.preventDefault();
    try {
      const result = applyDamage(state, combatant.tokenId, expression, categories.split(","), bypass);
      void useAppStore.getState().persist(result.state, `${result.result.finalAmount} de dano aplicado.`);
      setPanel(null);
    } catch (error) { reportError(error); }
  }
  function healing(event: FormEvent) {
    event.preventDefault();
    try {
      const result = applyHealing(state, combatant.tokenId, Number(heal));
      void useAppStore.getState().persist(result.state, result.recovered ? `${result.recovered} HP recuperado.` : "HP já está no máximo.");
      setPanel(null);
    } catch (error) { reportError(error); }
  }
  function turn(trigger: Trigger) {
    try {
      const result = processTurn(state, combatant.tokenId, trigger);
      void useAppStore.getState().persist(result.state, result.messages.join(" · ") || undefined);
    } catch (error) { reportError(error); }
  }

  return <article className={`combatant-card ${active ? "active" : ""}`}>
    <div className="combatant-main">
      <TokenPortrait token={token} />
      <div className="combatant-info">
        <div className="name-row"><h2>{token?.name ?? "Token removido"}</h2>{active && <span className="turn-chip">EM TURNO</span>}</div>
        <div className="hp-row"><div className="hp-track"><span style={{ width: `${hpPercent}%` }} /></div><strong>{combatant.currentHp}<small> / {combatant.maximumHp} HP</small></strong></div>
      </div>
    </div>

    {combatant.conditions.length > 0 && <div className="condition-list">{combatant.conditions.map((applied) => {
      const definition = state.conditionDefinitions.find((item) => item.id === applied.definitionId);
      if (!definition) return null;
      return <span className="condition-chip" key={applied.id}>{definition.name}{definition.maximumStacks > 1 && <> · {applied.stacks}</>}{applied.remainingTicks && <> · {applied.remainingTicks}t</>}<button title="Diminuir stack" disabled={applied.stacks <= 1} onClick={() => void commit(() => changeConditionStacks(state, combatant.tokenId, applied.id, -1))}>−</button><button title="Aumentar stack" disabled={applied.stacks >= definition.maximumStacks} onClick={() => void commit(() => changeConditionStacks(state, combatant.tokenId, applied.id, 1))}>+</button><button title="Remover condição" onClick={() => void commit(() => removeCondition(state, combatant.tokenId, applied.id))}>×</button></span>;
    })}</div>}

    <div className="card-actions">
      <button className={panel === "damage" ? "selected" : ""} onClick={() => setPanel(panel === "damage" ? null : "damage")}>Dano</button>
      <button className={panel === "heal" ? "selected" : ""} onClick={() => setPanel(panel === "heal" ? null : "heal")}>Cura</button>
      <button className={panel === "defense" ? "selected" : ""} onClick={() => setPanel(panel === "defense" ? null : "defense")}>Defesa</button>
      {!active ? <button className="turn" disabled={Boolean(state.activeTokenId)} onClick={() => turn("TURN_START")}>Iniciar turno</button> : <button className="turn end" onClick={() => turn("TURN_END")}>Encerrar turno</button>}
    </div>

    {panel === "damage" && <form className="inline-form" onSubmit={damage}><label>Dano<input autoFocus value={expression} onChange={(event) => setExpression(event.target.value)} placeholder="2d6+3" /></label><label>Tipos<input value={categories} onChange={(event) => setCategories(event.target.value)} placeholder="fogo, mágico" /></label><label className="check"><input type="checkbox" checked={bypass} onChange={(event) => setBypass(event.target.checked)} /> Ignorar reduções</label><button className="button danger">Aplicar</button></form>}
    {panel === "heal" && <form className="inline-form compact" onSubmit={healing}><label>HP a recuperar<input autoFocus inputMode="numeric" value={heal} onChange={(event) => setHeal(event.target.value)} /></label><button className="button heal">Curar</button></form>}
    {panel === "defense" && <ReductionEditor state={state} combatant={combatant} onDone={() => setPanel(null)} />}

    <div className="condition-apply">
      <select value={conditionId} onChange={(event) => setConditionId(event.target.value)}><option value="">Aplicar condição…</option>{state.conditionDefinitions.filter((definition) => !combatant.conditions.some((item) => item.definitionId === definition.id)).map((definition) => <option key={definition.id} value={definition.id}>{definition.name}</option>)}</select>
      <button disabled={!conditionId} onClick={() => { void commit(() => applyCondition(state, combatant.tokenId, conditionId)); setConditionId(""); }}>Aplicar</button>
      <button className="remove-link" onClick={() => { if (confirm(`Remover ${token?.name ?? "este combatente"} da Rulebear?`)) void commit(() => removeCombatant(state, combatant.tokenId)); }}>Remover</button>
    </div>
  </article>;
}

function ReductionEditor({ state, combatant, onDone }: { state: RulebearSceneState; combatant: CombatantState; onDone(): void }) {
  const [rows, setRows] = useState(() => combatant.reductions.map((row) => ({ ...row, categoriesText: row.categories.join(", ") })));
  function save(event: FormEvent) {
    event.preventDefault();
    const reductions: DamageReduction[] = rows.map(({ categoriesText, ...row }) => ({ ...row, amount: Number(row.amount), categories: categoriesText.split(",") }));
    void commit(() => setReductions(state, combatant.tokenId, reductions), "Reduções salvas.").then((saved) => { if (saved) onDone(); });
  }
  return <form className="reduction-editor" onSubmit={save}><span className="kicker">REDUÇÕES EM ORDEM</span>{rows.map((row, index) => <div className="reduction-row" key={row.id}><input aria-label="Nome da redução" value={row.label} onChange={(event) => setRows(rows.map((item, position) => position === index ? { ...item, label: event.target.value } : item))} placeholder="Armadura" /><input aria-label="Valor da redução" className="number" inputMode="numeric" value={row.amount} onChange={(event) => setRows(rows.map((item, position) => position === index ? { ...item, amount: Number(event.target.value) } : item))} /><input aria-label="Categorias" value={row.categoriesText} onChange={(event) => setRows(rows.map((item, position) => position === index ? { ...item, categoriesText: event.target.value } : item))} placeholder="físico" /><button type="button" onClick={() => setRows(rows.filter((_, position) => position !== index))}>×</button></div>)}<div className="editor-actions"><button type="button" className="text-button" onClick={() => setRows([...rows, { id: id(), label: "", amount: 0, categories: [], categoriesText: "" }])}>+ Redução</button><button className="button">Salvar</button></div></form>;
}

function ConditionLibrary({ state, onClose }: { state: RulebearSceneState; onClose(): void }) {
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
    void commit(() => saveConditionDefinition(state, definition), "Condição salva.").then(() => { setDraft(blank()); setHasEffect(false); setDuration(""); });
  }
  return <Dialog title="Biblioteca de condições" onClose={onClose} wide>
    <div className="definition-list">{state.conditionDefinitions.length === 0 ? <p>Nenhuma condição criada nesta cena.</p> : state.conditionDefinitions.map((definition) => <div key={definition.id}><button className="definition-name" onClick={() => edit(definition)}><strong>{definition.name}</strong><small>{definition.maximumStacks} stack(s){definition.duration ? ` · ${definition.duration.ticks} turno(s)` : ""}</small></button><button title="Excluir" onClick={() => { try { void useAppStore.getState().persist(deleteConditionDefinition(state, definition.id)); } catch (error) { reportError(error); } }}>×</button></div>)}</div>
    <form className="form-stack condition-form" onSubmit={save}><span className="kicker">{state.conditionDefinitions.some((item) => item.id === draft.id) ? "EDITAR" : "NOVA CONDIÇÃO"}</span><label>Nome<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Envenenado" /></label><div className="form-grid"><label>Máx. stacks<input inputMode="numeric" value={draft.maximumStacks} onChange={(event) => setDraft({ ...draft, maximumStacks: Number(event.target.value) })} /></label><label>Duração em turnos<input inputMode="numeric" value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="Sem duração" /></label></div><label className="check"><input type="checkbox" checked={hasEffect} onChange={(event) => setHasEffect(event.target.checked)} /> Executar efeito automático</label>{hasEffect && <div className="effect-grid"><select aria-label="Tipo do efeito" value={kind} onChange={(event) => setKind(event.target.value as "DAMAGE" | "HEAL")}><option value="DAMAGE">Dano</option><option value="HEAL">Cura</option></select><select aria-label="Momento do efeito" value={trigger} onChange={(event) => setTrigger(event.target.value as Trigger)}><option value="TURN_START">Início do turno</option><option value="TURN_END">Fim do turno</option></select><input aria-label="Valor do efeito" value={expression} onChange={(event) => setExpression(event.target.value)} placeholder="1d6" /></div>}<div className="dialog-actions"><button type="button" className="button" onClick={() => { setDraft(blank()); setHasEffect(false); }}>Limpar</button><button className="button primary">Salvar condição</button></div></form>
  </Dialog>;
}

function HistoryPanel({ state, tokens, onClose }: { state: RulebearSceneState; tokens: TokenView[]; onClose(): void }) {
  return <Dialog title="Histórico da cena" onClose={onClose} wide><ol className="history-list">{[...state.history].reverse().map((entry) => <li key={entry.id} className={entry.undoneAt ? "undone" : ""}><time>{new Date(entry.occurredAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time><div><strong>{entry.tokenId ? tokens.find((token) => token.id === entry.tokenId)?.name ?? "Token removido" : "Rulebear"}</strong><span>{entry.summary}{entry.undoneAt ? " · desfeito" : ""}</span></div></li>)}</ol>{state.history.length === 0 && <p className="empty-note">As ações deste encontro aparecerão aqui.</p>}</Dialog>;
}

function Dialog({ title, onClose, wide, children }: { title: string; onClose(): void; wide?: boolean; children: React.ReactNode }) {
  return <div className="dialog-backdrop" role="presentation"><section className={`dialog ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button aria-label="Fechar" onClick={onClose}>×</button></header>{children}</section></div>;
}

function TokenPortrait({ token }: { token?: TokenView }) {
  return token?.imageUrl ? <img className="portrait" src={token.imageUrl} alt="" /> : <span className="portrait fallback">{token?.name.slice(0, 1).toUpperCase() ?? "?"}</span>;
}
