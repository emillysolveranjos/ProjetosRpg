# Rulebear

Extensão nativa e exclusiva do [Owlbear Rodeo](https://www.owlbear.rodeo/) para o GM controlar HP, dano, cura, reduções, condições e turnos sem sair da cena.

> Status: desenvolvimento privado. O manifesto público e a entrada na loja serão liberados no lançamento 1.0.0.

## O que já funciona

- combatentes vinculados exclusivamente a tokens `IMAGE` da camada `CHARACTER`;
- inclusão pelo menu de contexto ou pela seleção atual;
- dano fixo ou em dados (`2d6+3`), categorias, reduções em sequência e bypass;
- cura limitada ao HP máximo;
- condições com stacks, duração e efeitos de dano/cura no início ou fim do turno;
- turno manual, histórico de 50 ações e Undo da última ação compatível;
- sincronização pela metadata da cena e atualização automática de nome/imagem do token;
- remoção automática quando o token deixa a cena;
- acesso e menu de contexto exclusivos do GM;
- estados seguros para cena ausente, metadata inválida e abertura fora do Owlbear.

## Desenvolvimento

Requisitos: Node.js 24+ e npm.

```bash
npm install
npm run dev
```

No Owlbear Rodeo, adicione durante o desenvolvimento este manifesto:

```text
http://localhost:5173/manifest.json
```

O servidor Vite aceita CORS apenas de `https://www.owlbear.rodeo`. Para visualizar a interface sem uma sala, use `http://localhost:5173/action.html?mock=1`; esse modo existe somente no build de desenvolvimento.

## Verificação

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm audit --audit-level=high
```

O build cria `action.html`, `background.html` e `manifest.json` em `dist/`, sem source maps. O limite aceito para o JavaScript/CSS comprimido é 500 KB.

## Estado da cena

A única fonte de verdade é `OBR.scene` em `io.github.samuelsanjos.rulebear/state`. A metadata possui `schemaVersion` e `revision`; entradas ausentes criam um estado vazio em memória, enquanto versões desconhecidas ou conteúdo inválido são mostrados como erro e nunca são sobrescritos silenciosamente.

Limites por cena: 50 combatentes, 25 definições de condição e 50 registros no histórico. Consulte [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) para as decisões de isolamento e sincronização.

## Publicação

O workflow de CI roda em pushes e pull requests. O deploy do Pages é separado e só inicia manualmente ou com uma tag `v*`, depois que este repositório for tornado público e o GitHub Pages estiver configurado para GitHub Actions.

URL planejada: `https://samuelsanjos.github.io/rulebear/manifest.json`.

## English

Rulebear is a native, Owlbear Rodeo-only GM extension for token-bound hit points, damage, healing, reductions, conditions, and manual turns. Scene metadata is the sole source of truth, players cannot view or edit the encounter, and there is no standalone mode or external server.

For local development, run `npm install` and `npm run dev`, then install `http://localhost:5173/manifest.json` in Owlbear Rodeo. See [docs/QA.md](docs/QA.md) for the release checklist.

## Licença

MIT © 2026 Zero.
