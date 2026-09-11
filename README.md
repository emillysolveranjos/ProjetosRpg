# Rulebear

Extensão nativa e exclusiva do [Owlbear Rodeo](https://www.owlbear.rodeo/) para o GM controlar HP, dano, cura, reduções, condições e turnos sem sair da cena.

> Distribuição por link de instalação. A extensão não está listada na loja do Owlbear.

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

## Instalação pública

1. No perfil do Owlbear, abra **Extensions → Add Extension**.
2. Cole `https://emillysolveranjos.github.io/ProjetosRpg/manifest.json`.
3. Na sala, abra **Extensions**, habilite **Rulebear** e abra seu painel como GM.

Não é necessário Node.js, servidor local ou uma conta GitHub para usar a extensão. O endereço público fica disponível após a conclusão do workflow de publicação.

Se você usava a versão local, desative essa instalação na sala antes de habilitar a pública para evitar duas instâncias. Os dados continuam na metadata da cena, com o mesmo identificador interno.

## Desenvolvimento

Requisitos: Node.js 24+ e npm.

```bash
npm install
npm run dev
```

No Owlbear Rodeo, adicione durante o desenvolvimento este manifesto:

```text
http://localhost:5174/manifest.json
```

Use o hostname `localhost`: a política CSP observada no Owlbear permite `http://localhost:*`, mas bloqueia `http://127.0.0.1:*`. O comando `npm run dev` fixa a porta 5174 e avisa se ela estiver ocupada. O servidor Vite aceita CORS de `https://www.owlbear.rodeo` e `https://extensions.owlbear.rodeo`. Para visualizar a interface sem uma sala, use `http://localhost:5174/action.html?mock=1`; esse modo existe somente no build de desenvolvimento.

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

O workflow de CI roda em pushes e pull requests. No repositório público `emillysolveranjos/ProjetosRpg`, configure **Settings → Pages → Source: GitHub Actions**. Para publicar, execute **Actions → Publicar GitHub Pages → Run workflow** na branch `main`. Atualizações também podem ser publicadas por tags `v*`; pushes comuns não fazem deploy.

A publicação depende de lint, tipos, testes, build, auditoria de dependências e verificação do pacote compilado. Somente `dist/` é hospedado. Se alguma validação falhar, o deploy não é executado e a publicação anterior permanece disponível.

URL de instalação: `https://emillysolveranjos.github.io/ProjetosRpg/manifest.json`.

## English

Rulebear is a native, Owlbear Rodeo-only GM extension for token-bound hit points, damage, healing, reductions, conditions, and manual turns. Scene metadata is the sole source of truth, players cannot view or edit the encounter, and there is no standalone mode or external server.

For local development, run `npm install` and `npm run dev`, then install `http://localhost:5174/manifest.json` in Owlbear Rodeo. See [docs/QA.md](docs/QA.md) for the release checklist.

## Licença

MIT © 2026 Zero.
