import { useEffect, useState, type FormEvent } from "react";
import type { CombatantState, Marker, RulebearSceneState, TokenView, Viewer } from "../domain/types";
import type { OwlbearGateway } from "../owlbear/gateway";
import { useAppStore } from "../state/store";
import { allowed, visibleCombatant, permitted, markerVisible, markerEditable, markerText, markerNumbers, visibleHistory } from "../domain/access";
import { AccessEditor } from "./AccessEditor";
import { MarkerEditor } from "./MarkerEditor";
import { ConditionLibrary, ReductionEditor } from "./RuleEditors";
import { Dialog, TokenPortrait } from "./Shared";
const send = (command: Parameters<ReturnType<typeof useAppStore.getState>["command"]>[0]) => useAppStore.getState().command(command);
export function App({ gateway }: { gateway?: OwlbearGateway }) {
  const store = useAppStore();
  const { status, state, tokens, error, notice, initialize, pendingTokenId, setPendingToken, self, role, online, busy } = store;
  const [preview, setPreview] = useState("");
  const [dialog, setDialog] = useState<"library" | "history" | "preferences" | null>(null);
  useEffect(() => {
    let disposed = false; let cleanup = () => {};
    void initialize(gateway).then((off) => { if (disposed) off(); else cleanup = off; });
    return () => { disposed = true; cleanup(); };
  }, [gateway, initialize]);
  const viewer: Viewer = role === "GM" && preview ? { id: preview, role: "PLAYER" } : self ?? { id: "", role: "PLAYER" };
  const gm = viewer.role === "GM";
  const previewing = role === "GM" && !!preview;
  const readOnly = busy || !online || previewing;
  const combatants = state.encounter.order.map((id) => state.combatants[id]).filter((c): c is CombatantState => !!c && visibleCombatant(c, viewer) && (gm || tokens.some((t) => t.id === c.tokenId && t.visible !== false)));
  const history = visibleHistory(state, viewer).filter((e) => gm || combatants.some((c) => c.tokenId === e.tokenId));
  if (status === "LOADING") return <Centered title="Abrindo a ficha da cena…" />;
  if (status === "OUTSIDE") return <main className="outside"><div className="brand-mark large">R</div><h1>Rulebear vive dentro da sua mesa.</h1><p>Instale a extensão no perfil e habilite-a na sala do Owlbear Rodeo.</p><a className="button primary" href="https://www.owlbear.rodeo" target="_blank" rel="noreferrer">Abrir Owlbear Rodeo</a></main>;
  if (status === "NO_SCENE") return <Centered title="Abra uma cena para começar" detail="Os encontros ficam salvos na cena do Owlbear Rodeo." />;
  if (status === "INVALID") return <Centered title="A cena precisa de atenção" detail={error} />;
  const players = [...new Map(store.participants.filter((p) => p.role === "PLAYER").map((p) => [p.id, p])).values()];
  const knownIds = [...new Set(Object.values(state.combatants).flatMap((c) => [...c.settings.owners, ...Object.values(c.settings.visibility).flatMap((v) => v.playerIds), ...c.markers.flatMap((m) => m.audience.playerIds)]))];
  for (const id of knownIds) if (!players.some((p) => p.id === id)) players.push({ id, connectionId: "", role: "PLAYER", name: "Desconectado (" + id.slice(0, 6) + ")" });
  return <main className="app-shell">
    <header className="topbar"><div className="brand-mark">R</div><div className="brand-copy"><span>RULEBEAR</span><strong>{gm ? "Mesa do GM" : "Minha mesa"}</strong></div>{gm && <button className="icon-button" title="Desfazer última ação" aria-label="Desfazer última ação" disabled={readOnly || !state.undo} onClick={() => void send({ type: "undo" })}>↶</button>}<button className="icon-button" title="Preferências visuais" aria-label="Preferências visuais" onClick={() => setDialog("preferences")}>⚙</button></header>
    {role === "GM" && <label className="preview-select">Ver como<select value={preview} onChange={(e) => { setPreview(e.target.value); setDialog(null); }}><option value="">Mestre</option>{players.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label>}
    {previewing && <p className="banner">Prévia de jogador · somente leitura</p>}
    {!online && <p className="banner">Aguardando mestre e sincronização. A consulta e as preferências continuam disponíveis.</p>}
    <section className="scene-summary"><div><span className="kicker">{state.encounter.started ? "RODADA " + state.encounter.round : "ENCONTRO ATUAL"}</span><h1>{combatants.length} combatente{combatants.length === 1 ? "" : "s"}</h1></div>{gm && <button className="button primary" disabled={readOnly} onClick={() => void store.requestSelectedToken()}>+ Token selecionado</button>}</section>
    {!previewing && (error || notice) && <div className={"flash " + (error ? "error" : "notice")} role="status"><span>{error ?? notice}</span><button onClick={store.clearMessage}>×</button></div>}
    <section className="encounter-controls">
      {gm && <div className="button-row"><button className="button" disabled={readOnly || !combatants.length} onClick={() => void send({ type: "sort" })}>Ordenar iniciativa</button>{!state.activeTokenId ? <button className="button primary" disabled={readOnly || !combatants.length} onClick={() => void send({ type: "start" })}>{state.encounter.started ? "Retomar" : "Iniciar encontro"}</button> : <button className="button primary" disabled={readOnly} onClick={() => void send({ type: "advance" })}>Próximo turno →</button>}{state.encounter.started && <button className="button" disabled={readOnly} onClick={() => void send({ type: "stop" })}>Encerrar encontro</button>}</div>}
      {state.activeTokenId && !combatants.some((c) => c.tokenId === state.activeTokenId) && <p className="muted">Turno em andamento.</p>}
      {state.encounter.paused && <p className="muted">Encontro pausado. O mestre escolhe o próximo participante.</p>}
    </section>
    <section className="roster" aria-label="Combatentes">
      {!combatants.length && <div className="empty-card"><span className="empty-glyph">◇</span><h2>{gm ? "Ninguém no encontro" : "Nenhum combatente liberado"}</h2><p>{gm ? "Selecione um token de personagem e adicione-o à Rulebear." : "O mestre escolhe quais tokens e informações aparecem para você."}</p></div>}
      {combatants.map((c) => <CombatantCard key={c.tokenId + "/" + viewer.id + "/" + viewer.role} combatant={c} token={tokens.find((t) => t.id === c.tokenId)} state={state} viewer={viewer} readOnly={readOnly} />)}
    </section>
    <footer className="footer-bar"><span>{busy ? "Salvando…" : online ? "Sincronizado" : "Consulta"}</span>{gm && <button className="text-button" onClick={() => setDialog("library")}>Condições</button>}<button className="text-button" onClick={() => setDialog("history")}>Histórico <b>{history.length}</b></button></footer>
    {pendingTokenId && gm && <AddDialog token={tokens.find((t) => t.id === pendingTokenId)} onClose={() => setPendingToken()} />}
    {dialog === "library" && gm && <ConditionLibrary state={state} onClose={() => setDialog(null)} />}
    {dialog === "history" && <Dialog title="Histórico da cena" onClose={() => setDialog(null)}><ol className="history-list">{[...history].reverse().map((e) => <li key={e.id} className={e.undoneAt ? "undone" : ""}><time>{new Date(e.occurredAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time><div><strong>{e.tokenId ? tokens.find((t) => t.id === e.tokenId)?.name ?? "Token removido" : "Rulebear"}</strong><span>{e.summary}{e.undoneAt ? " · desfeito" : ""}</span></div></li>)}</ol>{!history.length && <p>Nenhuma ação disponível para sua visualização.</p>}</Dialog>}
    {dialog === "preferences" && <Dialog title="Minha visualização" onClose={() => setDialog(null)}><label>Posição padrão dos marcadores<select value={store.preferences.position} onChange={(e) => store.setPreferences({ ...store.preferences, position: e.target.value as "TOP" | "BOTTOM" })}><option value="TOP">Acima dos tokens</option><option value="BOTTOM">Abaixo dos tokens</option></select></label><p className="muted">Só muda sua tela. Exceções por token ficam no cartão do combatente. Preferências são salvas neste navegador.</p><button className="button" onClick={() => store.setPreferences({ ...store.preferences, overrides: {} })}>Limpar minhas exceções</button>{gm && <button className="button" onClick={() => void gateway?.readBackup().then((value) => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = "rulebear-backups-v1.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }).catch(() => useAppStore.setState({ error: "Não foi possível exportar os backups." }))}>Baixar backups anteriores à migração</button>}</Dialog>}
  </main>;
}
function Centered({ title, detail }: { title: string; detail?: string }) { return <main className="centered-state"><div className="brand-mark large">R</div><h1>{title}</h1>{detail && <p>{detail}</p>}</main>; }
function AddDialog({ token, onClose }: { token?: TokenView; onClose(): void }) {
  const [hp, setHp] = useState("20"), [max, setMax] = useState("20");
  const { online, busy } = useAppStore();
  return <Dialog title="Adicionar combatente" onClose={onClose}>{token ? <form className="form-stack" onSubmit={(e) => { e.preventDefault(); void send({ type: "add", tokenId: token.id, currentHp: Number(hp), maximumHp: Number(max) }).then((ok) => { if (ok) onClose(); }); }}><strong>{token.name}</strong><label>HP máximo<input type="number" value={max} onChange={(e) => { setMax(e.target.value); if (hp === max) setHp(e.target.value); }} /></label><label>HP atual<input type="number" value={hp} onChange={(e) => setHp(e.target.value)} /></label><button className="button primary" disabled={!online || busy}>Adicionar</button></form> : <p>Token indisponível.</p>}</Dialog>;
}
function CombatantCard({ combatant: c, token, state, viewer, readOnly }: { combatant: CombatantState; token?: TokenView; state: RulebearSceneState; viewer: Viewer; readOnly: boolean }) {
  const [panel, setPanel] = useState<"damage" | "heal" | "defenses" | "access" | "markers" | null>(null);
  const [value, setValue] = useState("1"), [categories, setCategories] = useState(""), [bypass, setBypass] = useState(false);
  const [initiative, setInitiative] = useState(c.initiative === null ? "" : String(c.initiative));
  const [conditionId, setConditionId] = useState("");
  const { preferences, setPreferences } = useAppStore();
  const gm = viewer.role === "GM", active = state.activeTokenId === c.tokenId;
  const conditionVisible = allowed(c.settings.visibility.conditions, c, viewer);
  const index = state.encounter.order.indexOf(c.tokenId);
  const preferenceKey = state.sceneId + "/" + c.tokenId;
  const move = (delta: number) => { const order = [...state.encounter.order]; order.splice(index, 1); order.splice(index + delta, 0, c.tokenId); void send({ type: "order", order }); };
  function submit(e: FormEvent) {
    e.preventDefault();
    void send(panel === "damage" ? { type: "damage", tokenId: c.tokenId, expression: value, categories: categories.split(","), bypass } : { type: "heal", tokenId: c.tokenId, amount: Number(value) }).then((ok) => { if (ok) setPanel(null); });
  }
  return <article className={"combatant-card " + (active ? "active" : "")}>
    <div className="combatant-main"><TokenPortrait token={token} /><div className="combatant-info"><div className="name-row"><h2>{token?.name ?? "Token removido"}</h2>{active && <span className="turn-chip">EM TURNO</span>}</div>{allowed(c.settings.visibility.initiative, c, viewer) && <small>Iniciativa: {c.initiative ?? "—"}</small>}</div></div>
    <div className="marker-list">{c.markers.filter((m) => markerVisible(m, c, viewer)).map((m) => <MarkerRow key={m.id} marker={m} combatant={c} viewer={viewer} disabled={readOnly} />)}</div>
    {conditionVisible && <div className="condition-list">{c.conditions.map((applied) => {
      const definition = state.conditionDefinitions.find((d) => d.id === applied.definitionId);
      return <span className="condition-chip" key={applied.id}>{definition?.name ?? "Condição"} · {applied.stacks}{applied.remainingTicks !== undefined && " · " + applied.remainingTicks + "t"}{permitted(c, viewer, "conditions") && <><button disabled={readOnly || applied.stacks <= 1} onClick={() => void send({ type: "stacks", tokenId: c.tokenId, appliedId: applied.id, delta: -1 })}>−</button><button disabled={readOnly || applied.stacks >= (definition?.maximumStacks ?? 1)} onClick={() => void send({ type: "stacks", tokenId: c.tokenId, appliedId: applied.id, delta: 1 })}>+</button><button disabled={readOnly} title="Remover condição" onClick={() => void send({ type: "removeCondition", tokenId: c.tokenId, appliedId: applied.id })}>×</button></>}</span>;
    })}</div>}
    <div className="card-actions">
      {permitted(c, viewer, "damage") && <button disabled={readOnly} onClick={() => setPanel(panel === "damage" ? null : "damage")}>Dano</button>}
      {permitted(c, viewer, "heal") && <button disabled={readOnly} onClick={() => setPanel(panel === "heal" ? null : "heal")}>Cura</button>}
      {allowed(c.settings.visibility.defenses, c, viewer) && <button onClick={() => setPanel(panel === "defenses" ? null : "defenses")}>Defesa</button>}
      {active && permitted(c, viewer, "endTurn") && <button className="turn" disabled={readOnly} onClick={() => void send({ type: "advance" })}>Encerrar turno →</button>}
      {gm && !state.activeTokenId && <button className="turn" disabled={readOnly} onClick={() => void send({ type: "start", tokenId: c.tokenId })}>Iniciar turno</button>}
    </div>
    {(panel === "damage" && permitted(c, viewer, "damage") || panel === "heal" && permitted(c, viewer, "heal")) && <form className="inline-form" onSubmit={submit}><label>{panel === "damage" ? "Dano (ex.: 2d6+3)" : "HP a recuperar"}<input value={value} onChange={(e) => setValue(e.target.value)} /></label>{panel === "damage" && <><label>Tipos<input value={categories} onChange={(e) => setCategories(e.target.value)} placeholder="fogo, físico" /></label>{gm && <label className="check"><input type="checkbox" checked={bypass} onChange={(e) => setBypass(e.target.checked)} />Ignorar reduções</label>}</>}<button className="button" disabled={readOnly}>Aplicar</button></form>}
    {panel === "defenses" && allowed(c.settings.visibility.defenses, c, viewer) && (gm ? <fieldset disabled={readOnly} className="dialog-guard"><ReductionEditor state={state} combatant={c} onDone={() => setPanel(null)} /></fieldset> : <div className="inline-form">{c.reductions.length ? c.reductions.map((r) => <p key={r.id}>{r.label}: {r.amount} · {r.categories.join(", ") || "Todos os tipos"}</p>) : <p>Sem reduções.</p>}</div>)}
    {conditionVisible && permitted(c, viewer, "conditions") && <div className="condition-apply"><select aria-label="Condição" value={conditionId} onChange={(e) => setConditionId(e.target.value)}><option value="">Aplicar condição…</option>{state.conditionDefinitions.filter((d) => !c.conditions.some((a) => a.definitionId === d.id)).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select><button disabled={readOnly || !conditionId} onClick={() => void send({ type: "condition", tokenId: c.tokenId, definitionId: conditionId }).then((ok) => { if (ok) setConditionId(""); })}>Aplicar</button></div>}
    <details className="token-options"><summary>Opções do token</summary>
      {permitted(c, viewer, "initiative") && <form className="inline-form compact" onSubmit={(e) => { e.preventDefault(); void send({ type: "initiative", tokenId: c.tokenId, value: initiative.trim() ? Number(initiative) : null }); }}><label>Minha iniciativa<input type="number" step="any" value={initiative} onChange={(e) => setInitiative(e.target.value)} /></label><button className="button" disabled={readOnly}>Salvar</button></form>}
      <label>Posição só na minha tela<select value={preferences.overrides[preferenceKey] ?? ""} onChange={(e) => {
        const overrides = { ...preferences.overrides };
        if (e.target.value) overrides[preferenceKey] = e.target.value as "TOP" | "BOTTOM"; else delete overrides[preferenceKey];
        setPreferences({ ...preferences, overrides });
      }}><option value="">Usar meu padrão</option><option value="TOP">Acima</option><option value="BOTTOM">Abaixo</option></select></label>
      {gm && <div className="button-row"><button className="button" disabled={readOnly || index === 0} onClick={() => move(-1)}>↑ Ordem</button><button className="button" disabled={readOnly || index === state.encounter.order.length - 1} onClick={() => move(1)}>↓ Ordem</button><button className="button" onClick={() => setPanel("access")}>Acesso</button><button className="button" onClick={() => setPanel("markers")}>Marcadores</button><button className="button" disabled={readOnly} onClick={() => { if (confirm("Remover este combatente da Rulebear?")) void send({ type: "remove", tokenId: c.tokenId }); }}>Remover</button></div>}
    </details>
    {panel === "access" && gm && <AccessEditor combatant={c} onClose={() => setPanel(null)} />}
    {panel === "markers" && gm && <MarkerEditor combatant={c} onClose={() => setPanel(null)} />}
  </article>;
}
function MarkerRow({ marker: m, combatant: c, viewer, disabled }: { marker: Marker; combatant: CombatantState; viewer: Viewer; disabled: boolean }) {
  const [expression, setExpression] = useState("");
  const numbers = markerNumbers(m, c), edit = markerEditable(m, c, viewer);
  return <div className="marker-row"><div className="marker-caption"><span>{m.name}</span><strong>{markerText(m, c, viewer)}</strong></div>{m.kind === "bar" && <div className="hp-track"><span style={{ width: Math.max(0, Math.min(100, numbers.value / numbers.maximum * 100)) + "%", background: m.color }} /></div>}
    {edit && <form className="marker-adjust" onSubmit={(e) => { e.preventDefault(); void send({ type: "markerValue", tokenId: c.tokenId, markerId: m.id, expression }).then((ok) => { if (ok) setExpression(""); }); }}>
      {m.kind === "checkbox" ? <label className="check"><input type="checkbox" checked={m.checked} disabled={disabled} onChange={(e) => void send({ type: "markerValue", tokenId: c.tokenId, markerId: m.id, checked: e.target.checked })} />Marcar</label> : <>{m.kind === "counter" && <><button type="button" disabled={disabled} onClick={() => void send({ type: "markerValue", tokenId: c.tokenId, markerId: m.id, expression: "-1" })}>−</button><button type="button" disabled={disabled} onClick={() => void send({ type: "markerValue", tokenId: c.tokenId, markerId: m.id, expression: "+1" })}>+</button></>}<input aria-label={"Ajustar " + m.name} placeholder="=10, +2, -3…" value={expression} onChange={(e) => setExpression(e.target.value)} /><button disabled={disabled || !expression}>Aplicar</button></>}
    </form>}
  </div>;
}
