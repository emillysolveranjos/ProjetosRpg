# Checklist de aceitação

## Automatizado

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm audit --audit-level=high`
- [ ] JavaScript e CSS de produção abaixo de 500 KB gzip
- [ ] nenhum source map em `dist/`

## Sala real

- [ ] instalar pelo manifesto servido pelo Vite
- [ ] confirmar interface completa como GM e mensagem privada como jogador
- [ ] confirmar menu somente com um `IMAGE` em `CHARACTER`
- [ ] rejeitar zero, vários, outro tipo/camada e token duplicado
- [ ] adicionar pelo menu e pelo botão de token selecionado
- [ ] renomear token e observar o novo nome sem editar estado
- [ ] excluir token e observar remoção do combatente
- [ ] recarregar e comparar duas janelas conectadas
- [ ] aplicar dano, categorias, bypass, cura, reduções e Undo
- [ ] testar stacks, duração e efeitos no início/fim do turno
- [ ] confirmar estado sem cena
- [ ] testar temas claro/escuro, largura mobile, Chrome, Edge, Firefox e Safari

## Lançamento

- [ ] tornar `samuelsanjos/rulebear` público
- [ ] habilitar GitHub Pages com fonte GitHub Actions
- [ ] disparar `pages.yml` manualmente
- [ ] validar `https://samuelsanjos.github.io/rulebear/manifest.json`
- [ ] criar a tag `v1.0.0`
- [ ] substituir as capturas provisórias por capturas finais de uma sala real
- [ ] enviar `public/store/rulebear.md` ao repositório oficial de extensões
