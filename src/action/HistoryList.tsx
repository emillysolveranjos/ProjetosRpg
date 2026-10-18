import type { ReactNode } from "react";
import type { DamagePart, HistoryEntryView, HistoryEventView, RollRecord } from "../domain/types";

// Histórico em cartões: uma frase direta por acontecimento e os dados à vista, sem jargão.
type Tone = "damage" | "heal" | "turn" | "condition" | "neutral";
const ICONS: Record<Tone, string> = { damage: "⚔", heal: "✚", turn: "⏵", condition: "✦", neutral: "•" };
const toneOf = (event?: HistoryEventView): Tone => !event ? "neutral" : event.kind === "DAMAGE" ? "damage" : event.kind === "HEAL" ? "heal" : event.kind === "TURN" ? "turn" : event.kind === "CONDITION" ? "condition" : "neutral";

export function HistoryList({ entries, nameOf }: { entries: HistoryEntryView[]; nameOf(tokenId?: string): string }) {
  if (!entries.length) return <p className="muted">Nenhuma ação disponível para sua visualização.</p>;
  return <ol className="history-feed">{[...entries].reverse().map((entry) => <HistoryCard key={entry.id} entry={entry} nameOf={nameOf} />)}</ol>;
}

function HistoryCard({ entry, nameOf }: { entry: HistoryEntryView; nameOf(tokenId?: string): string }) {
  const events = entry.events ?? [];
  // No avanço de turno, a manchete é quem começa a vez; o resto vira a lista de detalhes.
  const main = events.find((e) => e.kind === "TURN" && e.phase === "START") ?? events[0];
  const rest = events.filter((e) => e !== main);
  const tone = toneOf(main);
  const time = new Date(entry.occurredAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return <li className={`history-card tone-${tone} ${entry.undoneAt ? "undone" : ""}`}>
    <span className="history-icon" aria-hidden="true">{ICONS[tone]}</span>
    <div className="history-body">
      {main ? <EventView event={main} nameOf={nameOf} /> : <LegacyEntry entry={entry} nameOf={nameOf} />}
      {rest.length > 0 && <ul className="history-sub">{rest.map((event, index) => <li key={index} className={`tone-${toneOf(event)}`}><span className="sub-icon" aria-hidden="true">{ICONS[toneOf(event)]}</span><div className="history-body"><EventView event={event} nameOf={nameOf} compact /></div></li>)}</ul>}
    </div>
    <div className="history-meta"><time>{time}</time>{entry.undoneAt && <span className="undone-chip">desfeito</span>}</div>
  </li>;
}

function EventView({ event, nameOf, compact = false }: { event: HistoryEventView; nameOf(tokenId?: string): string; compact?: boolean }) {
  const who = <strong>{nameOf(event.tokenId)}</strong>;
  if ("hidden" in event) return <p className="history-title">{who} {event.kind === "DAMAGE" ? "levou dano" : event.kind === "HEAL" ? "recuperou HP" : "teve o HP ajustado"}</p>;
  switch (event.kind) {
    case "TURN":
      return <p className="history-title">{event.phase === "START" ? <>Vez de {who}{event.round > 0 && <span className="round-chip">Rodada {event.round}</span>}</> : <>{who} terminou o turno</>}</p>;
    case "CONDITION": {
      const name = <em>{event.name}</em>;
      const text: Record<typeof event.change, ReactNode> = {
        APPLIED: <>{who} recebeu {name}{event.stacks && event.stacks > 1 ? ` ×${event.stacks}` : ""}</>,
        REMOVED: <>{who} perdeu {name}</>,
        STACKS: <>{name} em {who}: ×{event.stacks}</>,
        EXPIRED: <>{name} terminou em {who}</>,
      };
      return <p className="history-title">{text[event.change]}</p>;
    }
    case "HP":
      return <p className="history-title">{event.target === "CURRENT" ? "HP" : "HP máximo"} de {who}: <b className="num">{event.before} → {event.after}</b></p>;
    case "HEAL":
      return <>
        <p className="history-title">{event.amount > 0 ? <>{who} recuperou <b className="num heal">{event.amount}</b> de HP</> : <>{who} já estava com o HP cheio</>}{event.source && <> com <em>{event.source}</em></>}{!compact && event.amount > 0 && <HpChange before={event.hpBefore} after={event.hpAfter} />}</p>
        {event.roll && <DiceLine roll={event.roll} />}
      </>;
    case "DAMAGE": {
      const types = [...new Set(event.parts.flatMap((part) => part.types))];
      const allImmune = event.total === 0 && event.parts.every((part) => part.immune);
      return <>
        <p className="history-title">{allImmune ? <>{who} ficou imune ao dano</> : event.total === 0 ? <>As defesas de {who} anularam o dano</> : <>{who} levou <b className="num damage">{event.total}</b> de dano</>}{types.length > 0 && <span className="type-note"> · {types.join(" + ")}</span>}{event.source && <> por <em>{event.source}</em></>}{!compact && event.total > 0 && <HpChange before={event.hpBefore} after={event.hpAfter} />}</p>
        {event.parts.map((part, index) => <DamageLine key={index} part={part} showFinal={event.parts.length > 1} />)}
      </>;
    }
  }
}

function HpChange({ before, after }: { before: number; after: number }) {
  return <span className="hp-change">HP {before} → {after}</span>;
}

/** 🎲 2d6+3 → [4] [5] +3 = 12 */
function DiceLine({ roll, multiplier = 1, children }: { roll: RollRecord; multiplier?: number; children?: ReactNode }) {
  const sum = roll.rolls.reduce((total, value) => total + value, 0);
  const modifier = roll.rolls.length && !roll.truncated ? roll.total - sum : 0;
  if (!roll.rolls.length && multiplier === 1 && !children) return null;
  return <p className="dice-line">
    <span aria-hidden="true">🎲</span>
    {roll.rolls.length ? <>
      <code>{roll.expression}</code><span className="dice-arrow">→</span>
      {roll.rolls.map((value, index) => <span className="die" key={index}>{value}</span>)}
      {roll.truncated && <span className="dice-more">…</span>}
      {modifier !== 0 && <span className="dice-mod">{modifier > 0 ? "+" : "−"}{Math.abs(modifier)}</span>}
      <span className="dice-total">= {roll.total}</span>
    </> : <span className="dice-total">valor fixo {roll.total}</span>}
    {multiplier > 1 && <span className="dice-tag">×{multiplier} pelos acúmulos</span>}
    {children}
  </p>;
}

function DamageLine({ part, showFinal }: { part: DamagePart; showFinal: boolean }) {
  const raw = part.roll.total * part.multiplier;
  const reduction = part.immune ? 0 : Math.min(raw, Math.max(0, part.rd - part.penetration));
  const notes = <>
    {part.immune && <span className="dice-tag">imune</span>}
    {reduction > 0 && <span className="dice-tag">defesa −{reduction}</span>}
    {part.penetration > 0 && !part.immune && <span className="dice-tag">ignorou {Math.min(part.penetration, part.rd)} de RD</span>}
    {showFinal && <span className="dice-final">→ {part.final}{part.types.length ? ` de ${part.types.join(" + ")}` : ""}</span>}
  </>;
  const explains = part.immune || reduction > 0 || part.penetration > 0 || showFinal || part.multiplier > 1;
  return part.roll.rolls.length || explains ? <DiceLine roll={part.roll} multiplier={part.multiplier}>{notes}</DiceLine> : null;
}

function LegacyEntry({ entry, nameOf }: { entry: HistoryEntryView; nameOf(tokenId?: string): string }) {
  return <>
    <p className="history-title">{entry.tokenId && <strong>{nameOf(entry.tokenId)}</strong>}{entry.tokenId ? " · " : ""}{entry.summary}</p>
    {entry.damageDetails?.map((detail, index) => <p className="dice-line" key={index}><span className="dice-total">{detail.source ? detail.source + ": " : ""}{detail.final} de dano</span>{detail.immune ? <span className="dice-tag">imune</span> : detail.rd - detail.penetration > 0 && <span className="dice-tag">defesa −{Math.min(detail.raw, detail.rd - detail.penetration)}</span>}{detail.types.length > 0 && <span className="type-note">{detail.types.join(" + ")}</span>}</p>)}
  </>;
}
