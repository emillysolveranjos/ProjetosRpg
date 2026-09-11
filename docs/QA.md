# Checklist de aceitação

## Automatizado

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build:pages`
- [ ] `npm audit --audit-level=high`
- [ ] JavaScript e CSS de produção abaixo de 500 KB gzip
- [ ] nenhum source map em `dist/`

Auditoria local: dois avisos moderados na cadeia do SDK Owlbear → uuid, sem correção disponível reportada pelo npm. Nenhum aviso alto ou crítico.

## Sala real

- [ ] instalar pelo manifesto público HTTPS com o servidor local desligado
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

- [ ] tornar `emillysolveranjos/ProjetosRpg` público
- [ ] habilitar GitHub Pages com fonte GitHub Actions
- [ ] disparar `pages.yml` manualmente
- [ ] validar `https://emillysolveranjos.github.io/ProjetosRpg/manifest.json`
- [ ] confirmar manifesto, ícones, painel e background por HTTPS no caminho `/ProjetosRpg/`

A submissão à loja está fora desta publicação por link. As capturas e o arquivo de catálogo são rascunhos para uma etapa futura.
