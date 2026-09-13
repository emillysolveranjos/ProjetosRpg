import { defaultMarker } from "./defaults";
import type { Marker } from "./types";
export interface ImportCandidate { sourceId: string; marker: Marker }
export function readOwlTrackers(metadata: Record<string, unknown>): ImportCandidate[] {
  const raw = metadata["com.owl-trackers/trackers"];
  if (!Array.isArray(raw)) return [];
  const colors = ["#d94848", "#e89030", "#d6b32d", "#77ad41", "#38bdb0", "#4289dc", "#7962c9", "#b35ca6", "#89949f"];
  return raw.slice(0, 12).flatMap((t: unknown) => {
    if (!t || typeof t !== "object") return [];
    const x = t as Record<string, unknown>;
    const variants: Record<string, Marker["kind"]> = { "value-max": "bar", value: "number", counter: "counter", checkbox: "checkbox" };
    const kind = typeof x.variant === "string" ? variants[x.variant] : undefined;
    if (!kind || typeof x.id !== "string") return [];
    if (kind !== "checkbox" && (typeof x.value !== "number" || !Number.isFinite(x.value))) return [];
    if (kind === "bar" && (typeof x.max !== "number" || !Number.isFinite(x.max))) return [];
    if (kind === "checkbox" && typeof x.checked !== "boolean") return [];
    return [{ sourceId: x.id, marker: { ...defaultMarker(), kind, name: typeof x.name === "string" && x.name.trim() ? x.name.slice(0, 50) : "Marcador importado", value: typeof x.value === "number" ? x.value : 0, maximum: typeof x.max === "number" && x.max > 0 ? x.max : 1, checked: x.checked === true, color: colors[typeof x.color === "number" ? x.color : 0] ?? "#89949f", onMap: x.showOnMap !== false } }];
  });
}
export function mergeImported(existing: Marker[], candidates: ImportCandidate[], hpSource: string, mode: "append" | "replace") {
  let markers = mode === "append" ? structuredClone(existing) : structuredClone(existing.filter((m) => m.hp));
  let hpValues: { currentHp: number; maximumHp: number } | undefined;
  for (const candidate of candidates) {
    const m = structuredClone(candidate.marker);
    if (candidate.sourceId === hpSource) {
      if (m.kind !== "bar" || !Number.isSafeInteger(m.maximum) || m.maximum < 1 || m.maximum > 2_147_483_647 || !Number.isSafeInteger(m.value) || Math.abs(m.value) > 2_147_483_647) throw new Error("A barra escolhida como HP precisa ter valores inteiros válidos e máximo positivo.");
      m.hp = true; m.id = markers.find((item) => item.hp)?.id ?? "hp";
      hpValues = { currentHp: m.value, maximumHp: m.maximum }; m.value = 0; m.maximum = 1;
      markers = markers.map((old) => old.hp ? m : old);
    } else markers.push(m);
  }
  if (markers.length > 12) throw new Error("A importação excede 12 marcadores. Selecione menos marcadores ou substitua os personalizados.");
  return { markers, ...hpValues };
}
