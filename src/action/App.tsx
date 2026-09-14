import { useEffect, useState } from "react";
import type { CombatantState, HorizontalPreference, MarkerSizePreference, PositionPreference, TokenView, Viewer } from "../domain/types";
import type { OwlbearGateway } from "../owlbear/gateway";
import { useAppStore } from "../state/store";
import { visibleCombatant, visibleHistory } from "../domain/access";
import { CompactCard } from "./CompactCard";
import "../styles/compact.css";
import { LibraryDialog } from "./RuleEditors";
import { Dialog } from "./Shared";
const send = (command: Parameters<ReturnType<typeof useAppStore.getState>["command"]>[0]) => useAppStore.getState().command(command);
export function App({ gateway }: { gateway?: OwlbearGateway }) {
  const store = useAppStore();
  const { status, state, tokens, error, notice, initialize, pendingTokenId, setPendingToken, self, role, online, busy } = store;
  const [expanded, setExpanded] = useState<string | null>(null);
  const [preview, setPreview] = useState("");
  const [dialog, setDialog] = useState<"library" | "history" | "preferences" | "encounter" | null>(null);
  useEffect(() => {
    let disposed = false; let cleanup = () => {};
    void initialize(gateway).then((off) => { if (disposed) off(); else cleanup = off; });
    return () => { disposed = true; cleanup(); };
  }, [gateway, initialize]);
  useEffect(() => {
    if (!notice || busy) return;
    const timer = setTimeout(() => useAppStore.setState({ notice: undefined }), 3000);
    return () => clearTimeout(timer);
  }, [notice, busy, state.revision]);
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
  const knownIds = [...new Set(Object.values(state.combatants).flatMap((c) => [...c.settings.owners, ...Object.values(c.settings.permissions).flat(), ...Object.values(c.settings.visibility).flatMap((v) => v.playerIds), ...c.markers.flatMap((m) => m.audience.playerIds)]))];
  for (const id of knownIds) if (!players.some((p) => p.id === id)) players.push({ id, connectionId: "", role: "PLAYER", name: "Desconectado (" + id.slice(0, 6) + ")" });
  return <main className="app-shell compact-app">
    <header className="topbar"><div className="brand-mark">R</div><div className="brand-copy"><span>RULEBEAR</span><strong>{gm ? "Mesa do GM" : "Minha mesa"}</strong></div>{gm && <button className="icon-button" title="Desfazer última ação" aria-label="Desfazer última ação" disabled={readOnly || !state.undo} onClick={() => void send({ type: "undo" })}>↶</button>}<button className="icon-button" title="Preferências visuais" aria-label="Preferências visuais" onClick={() => setDialog("preferences")}>⚙</button></header>
    {previewing && <div className="preview-banner"><span>Prévia de jogador · somente leitura<br /><strong>{players.find((p) => p.id === preview)?.name}</strong></span><button className="button" onClick={() => { setPreview(""); setExpanded(null); }}>Voltar ao mestre</button></div>}
    {!online && <p className="connection-note" role="status">Somente consulta · aguardando mestre e sincronização.</p>}
    <section className="encounter-strip" aria-label="Encontro"><div><h1>{combatants.length} combatente{combatants.length === 1 ? "" : "s"}</h1><span className="muted">{state.encounter.started ? "Rodada " + state.encounter.round : "Preparação"}</span></div>{gm && <><button className="button primary" disabled={readOnly || !combatants.length} onClick={() => void send({ type: state.activeTokenId ? "advance" : "start" })}>{state.activeTokenId ? "Próximo →" : state.encounter.started ? "Retomar" : "Iniciar"}</button><button className="icon-button" title="Adicionar token selecionado" aria-label="+ Token selecionado" disabled={readOnly} onClick={() => void store.requestSelectedToken()}>+</button><button className="icon-button" aria-label="Opções do encontro" onClick={() => setDialog("encounter")}>⋯</button></>}</section>
    {!previewing && error && <div className="flash error" role="alert"><span>{error}</span><button aria-label="Dispensar erro" onClick={store.clearMessage}>×</button></div>}
    {state.activeTokenId && !combatants.some((c) => c.tokenId === state.activeTokenId) && <p className="connection-note">Turno em andamento.</p>}
    {state.encounter.paused && <p className="connection-note">Encontro pausado. O mestre escolhe o próximo participante.</p>}
    <section className="roster" aria-label="Combatentes">
      {!combatants.length && <div className="empty-card"><span className="empty-glyph">◇</span><h2>{gm ? "Ninguém no encontro" : "Nenhum combatente liberado"}</h2><p>{gm ? "Selecione um token de personagem e use o botão +." : "O mestre escolhe quais tokens e informações aparecem para você."}</p></div>}
      {combatants.map((c) => <CompactCard key={state.sceneId + "/" + c.tokenId + "/" + viewer.id + "/" + viewer.role} combatant={c} token={tokens.find((t) => t.id === c.tokenId)} state={state} viewer={viewer} readOnly={readOnly} previewing={previewing} expanded={expanded === c.tokenId} onExpand={() => setExpanded(c.tokenId)} onToggle={() => setExpanded(expanded === c.tokenId ? null : c.tokenId)} />)}
    </section>
    <footer className="footer-bar"><span role="status">{busy ? "Salvando…" : notice && !previewing ? "✓ Salvo" : online ? "Sincronizado" : "Consulta"}</span>{gm && <button className="library-button" onClick={() => setDialog("library")}><span aria-hidden="true">📚</span> Biblioteca</button>}<button className="text-button" onClick={() => setDialog("history")}>Histórico <b>{history.length}</b></button></footer>
    {pendingTokenId && gm && <AddDialog token={tokens.find((t) => t.id === pendingTokenId)} onClose={() => setPendingToken()} />}
    {dialog === "library" && gm && <LibraryDialog state={state} onClose={() => setDialog(null)} />}
    {dialog === "encounter" && gm && <Dialog title="Opções do encontro" onClose={() => setDialog(null)}><div className="form-stack"><button className="button" disabled={readOnly || !combatants.length} onClick={() => void send({ type: "sort" }).then((ok) => { if (ok) setDialog(null); })}>Ordenar iniciativa</button><p className="muted">Maior iniciativa primeiro. Ajuste empates nos detalhes do combatente.</p>{state.encounter.started && <button className="button" disabled={readOnly} onClick={() => void send({ type: "stop" }).then((ok) => { if (ok) setDialog(null); })}>Encerrar encontro</button>}</div></Dialog>}
    {dialog === "history" && <Dialog title="Histórico da cena" onClose={() => setDialog(null)}><ol className="history-list">{[...history].reverse().map((e) => <li key={e.id} className={e.undoneAt ? "undone" : ""}><time>{new Date(e.occurredAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time><div><strong>{e.tokenId ? tokens.find((t) => t.id === e.tokenId)?.name ?? "Token removido" : "Rulebear"}</strong><span>{e.summary}{e.undoneAt ? " · desfeito" : ""}</span>{e.damageDetails?.map((detail, index) => <p className="damage-history" key={index}><strong>{index + 1}. {tokens.find((token) => token.id === detail.tokenId)?.name ?? "Token removido"} · {detail.source ? detail.source + " · " : ""}{detail.types.join(" + ") || "Sem tipo"}</strong><span>Bruto {detail.raw} · {detail.immune ? "Imune" : `RD ${detail.rd} − penetração ${detail.penetration} = ${Math.max(0, detail.rd - detail.penetration)}`}{detail.ignoreImmunity ? " · Ignorar imunidade" : ""} → {detail.final} de dano</span></p>)}</div></li>)}</ol>{!history.length && <p>Nenhuma ação disponível para sua visualização.</p>}</Dialog>}
    {dialog === "preferences" && <Dialog title="Minha visualização" onClose={() => setDialog(null)}>{role === "GM" && <label className="preview-select">Ver como<select value={preview} onChange={(e) => { setPreview(e.target.value); setExpanded(null); setDialog(null); }}><option value="">Mestre</option>{players.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label>}<div className="display-preference-grid"><label>Posição vertical padrão<select value={store.preferences.position} onChange={(e) => store.setPreferences({ ...store.preferences, position: e.target.value as PositionPreference })}><option value="TOP">Acima dos tokens</option><option value="BOTTOM">Abaixo dos tokens</option></select></label><label>Alinhamento horizontal padrão<select value={store.preferences.horizontal} onChange={(e) => store.setPreferences({ ...store.preferences, horizontal: e.target.value as HorizontalPreference })}><option value="LEFT">Esquerda</option><option value="CENTER">Centro</option><option value="RIGHT">Direita</option></select></label><label>Tamanho padrão dos marcadores<select value={store.preferences.size} onChange={(e) => store.setPreferences({ ...store.preferences, size: e.target.value as MarkerSizePreference })}><option value="SMALL">Pequeno</option><option value="MEDIUM">Médio</option><option value="LARGE">Grande</option></select></label></div><p className="muted">Só muda sua tela. Cada propriedade pode ter uma exceção no cartão do combatente. As preferências ficam salvas por usuário e sala neste navegador.</p><button className="button" onClick={() => store.setPreferences({ ...store.preferences, overrides: {} })}>Limpar minhas exceções</button>{gm && <button className="button" onClick={() => void gateway?.readBackup().then((value) => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = "rulebear-backups.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }).catch(() => useAppStore.setState({ error: "Não foi possível exportar os backups." }))}>Baixar backups anteriores à migração</button>}</Dialog>}
  </main>;
}
function Centered({ title, detail }: { title: string; detail?: string }) { return <main className="centered-state"><div className="brand-mark large">R</div><h1>{title}</h1>{detail && <p>{detail}</p>}</main>; }
function AddDialog({ token, onClose }: { token?: TokenView; onClose(): void }) {
  const [hp, setHp] = useState("20"), [max, setMax] = useState("20");
  const { online, busy } = useAppStore();
  return <Dialog title="Adicionar combatente" onClose={onClose}>{token ? <form className="form-stack" onSubmit={(e) => { e.preventDefault(); void send({ type: "add", tokenId: token.id, currentHp: Number(hp), maximumHp: Number(max) }).then((ok) => { if (ok) onClose(); }); }}><strong>{token.name}</strong><label>HP máximo<input type="number" value={max} onChange={(e) => { setMax(e.target.value); if (hp === max) setHp(e.target.value); }} /></label><label>HP atual<input type="number" value={hp} onChange={(e) => setHp(e.target.value)} /></label><button className="button primary" disabled={!online || busy}>Adicionar</button></form> : <p>Token indisponível.</p>}</Dialog>;
}
