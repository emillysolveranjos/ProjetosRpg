import OBR from "@owlbear-rodeo/sdk";
import { renderGroup } from "./render";
import { GROUPS } from "./scenarios";

// Prévia local do mapa (somente desenvolvimento): /map-preview.html?group=hp
// Fora de uma sala o SDK não tem usuário, e os construtores de itens pedem um. Só a prévia usa este ID fictício.
Object.defineProperty(OBR.player, "id", { value: "preview" });
const params = new URLSearchParams(location.search);
const selected = GROUPS.filter((group) => !params.get("group") || group.id === params.get("group"));
const root = document.getElementById("root")!;
// capture=1: só o SVG, sem margens, para o script de captura usar o tamanho exato.
if (params.get("capture")) document.body.classList.add("capture");
const nav = GROUPS.map((group) => `<a href="?group=${group.id}"${selected.length === 1 && selected[0] === group ? ` aria-current="page"` : ""}>${group.title}</a>`).join("");
root.innerHTML = `<nav>${nav}<a href="?">Todos</a></nav>` + selected.map((group) => {
  const { svg } = renderGroup(group);
  return `<section><h1>${group.title}</h1><p>${group.description}</p>${svg}</section>`;
}).join("");
document.body.dataset.ready = "true";
