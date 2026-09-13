# Rulebear

Extensão do [Owlbear Rodeo](https://www.owlbear.rodeo/) para mestres e jogadores: iniciativa, HP, dano, cura, defesas, condições e marcadores visíveis nos tokens.

## Instalar ou atualizar

1. No perfil do Owlbear, abra **Extensions → Add Extension**.
2. Cole [o link de instalação](https://emillysolveranjos.github.io/ProjetosRpg/manifest.json).
3. Na sala, habilite **Rulebear** em **Extensions** e abra o botão do urso.
4. Se já estava instalada, recarregue a sala em todos os participantes para carregar a versão 2.1.0.

Sem servidor local, conta GitHub ou login adicional. Distribuição por link; não está na loja do Owlbear. Desative instalações locais antigas na sala para não executar duas versões sobre o mesmo encontro.

## Preparar a mesa

- Como mestre, selecione um token da camada **Personagem** e clique em **+ Token selecionado**, ou use o menu de contexto **Adicionar à Rulebear**.
- Abra **⋯ no cartão → Acesso**. Atribua os responsáveis, libere nome/participação e escolha as informações e ações permitidas.
- Abra **Marcadores** para configurar HP e até 11 recursos adicionais. Cada marcador tem nome, cor, audiência, exibição e permissão de edição.
- Use **Engrenagem → Ver como** para conferir a visão de um jogador, sem executar ações por ele.
- Todas as informações começam restritas aos mestres. Ser responsável pelo token não concede acesso automaticamente.
- Os jogadores entram usando a mesma extensão e veem somente o que foi liberado na interface. Ações permitidas são aplicadas diretamente, sem aprovação a cada clique.

**Visibilidade não é sigilo técnico:** todos os dados ficam na metadata compartilhada da cena. A Rulebear filtra a interface; ferramentas de desenvolvimento e outras extensões podem consultar esses dados.

## Iniciativa e turnos

Clique em **Iniciativa** no cartão para digitar o valor. O mestre usa **⋯ do encontro → Ordenar iniciativa** e os botões de ordem para resolver empates ou ajustar a fila. Alterar um valor não reorganiza automaticamente o encontro.

**Iniciar** abre a rodada 1. **Próximo →** executa os efeitos de fim do participante atual e início do próximo em uma única operação. Ao completar a fila, a rodada aumenta. O dono do token ativo pode encerrar o turno se o mestre permitir.

Novos combatentes entram no fim. Remover o ativo pausa o encontro; o mestre escolhe em qual token retomar. **Undo**, exclusivo dos mestres, restaura a última operação e seus efeitos sobre HP, condições, ordem e rodada.

Dano aceita números e dados, como `2d6+3`, categorias e reduções em sequência. O dano pode levar o HP abaixo de zero. Cura soma a partir do valor negativo e para no HP máximo; se o token já tiver sobrevida, a cura preserva esse valor. A biblioteca permite condições com stacks, duração e efeitos no início/fim do turno. Iniciativa não possui rolagem nesta versão.

## Painel compacto

Clique no **valor ou barra de HP** para escolher Dano, Cura ou Ajuste; clique nos demais recursos para editá-los. Só aparecem ações autorizadas. Informações sem permissão de edição permanecem em modo de leitura. Os detalhes de um único cartão ficam abertos por vez.

O botão **⋯ no cartão** reúne condições, defesas, acesso, marcadores, posição e ordem. Configurações completas continuam em janelas próprias. A confirmação de salvamento aparece brevemente no rodapé. A prévia do jogador é somente leitura e tem **Voltar ao mestre**.

## Marcadores e posição

No mapa, HP aparece como uma barra arredondada junto à borda do token, com o valor centralizado dentro dela. Números e contadores ficam em círculos ou cápsulas voltados para a imagem; barras adicionais ficam do lado externo. Valores longos e múltiplos contadores se distribuem em linhas. O conjunto acompanha a posição vertical, o alinhamento horizontal, o tamanho e a visibilidade escolhidos por cada participante.

Quatro tipos: **barra atual/máximo**, **número**, **contador** e **marcação**. A barra de HP usa os próprios valores do combate; não existe um segundo HP.

Ajustes numéricos aceitam `=10`, `+2`, `-3`, `*2` e `/2`, sem executar código. Para atribuir um número negativo, use `=-3`. HP negativo aparece com a barra vazia. Um ajuste acima do máximo cria sobrevida: `25/20` representa 5 pontos temporários, destacados em azul. Recursos personalizados aceitam valores finitos; barras limitam apenas o preenchimento visual a 0–100%.

- Na engrenagem **Minha visualização**, escolha **Acima/Abaixo**, **Esquerda/Centro/Direita** e **Pequeno/Médio/Grande**. O padrão inicial é **Abaixo + Centro + Médio**.
- Em **⋯ no cartão**, crie exceções independentes de posição, alinhamento e tamanho só para aquele token na própria tela. **Usar meu padrão** herda cada escolha global separadamente.
- **Limpar minhas exceções** devolve todos os tokens ao padrão pessoal atual.
- As preferências ficam no navegador, por usuário/sala; exceções também distinguem a cena. Não sincronizam entre dispositivos.
- As barras funcionam com o painel fechado. Tokens invisíveis não mostram marcadores aos jogadores.
- Modelos de marcadores ficam salvos na cena. Aplicar um modelo preserva o HP atual/máximo do combatente.

## Importar Owl Trackers

Em **Marcadores → Importar do Owl Trackers**, confira a prévia, selecione os marcadores e escolha qual barra corresponde ao HP, se houver. Decida entre acrescentar recursos e substituir os personalizados existentes, respeitando o limite de 12. A importação fica no rascunho até **Salvar marcadores**.

Os dados originais são preservados e não há sincronização contínua. Depois de conferir o resultado, desative o Owl Trackers na sala para evitar barras duplicadas. Barras importadas com máximo zero usam máximo 1 na prévia; HP exige valores inteiros válidos.

## Sincronização e migração

É necessário um mestre conectado e com a extensão ativa para alterar o encontro. Seu painel pode estar fechado. Sem mestre, jogadores continuam consultando dados e ajustando preferências visuais.

O background elege um mestre coordenador e processa comandos em sequência. Durante reconexões há uma breve espera. Se o estado mudou, a ação é rejeitada para evitar sobrescrever alterações. Se uma confirmação não chegar, confira os valores antes de tentar de novo: a Rulebear não repete a ação automaticamente.

Cenas v1 e v2 são migradas para v3 por um mestre, preservando HP, defesas, condições, histórico, turno e o Undo compatível da v2. A migração v1 inicia acesso restrito, não atribui iniciativas e reinicia o Undo antigo. Antes da conversão, o navegador do mestre guarda um backup. Exporte-o pela engrenagem em **Baixar backups anteriores à migração**; esse arquivo contém os dados originais para recuperação. Não limpe o armazenamento do navegador antes de exportar. Se não puder salvar o backup, a migração não grava a cena. Todos os participantes devem recarregar a Rulebear após a atualização.

Dados inválidos ou versões futuras não são substituídos. Limites: 50 combatentes, 12 marcadores por token, 25 definições de condição, 25 modelos e 50 registros de histórico.

## Desenvolvimento e publicação

Node.js 24+ e npm:

```sh
npm ci
npm run dev
npm run lint
npm run typecheck
npm test
npm run build:pages
npm audit --audit-level=high
```

Desenvolvimento: `http://localhost:5174/manifest.json`. O hostname `localhost` é necessário para a política CSP observada no Owlbear. O modo de demonstração `/action.html?mock=1` (ou `&role=player`) existe somente em desenvolvimento.

O CI verifica pushes e pull requests. Publicação é manual em **Actions → Publicar GitHub Pages → Run workflow**, ou por tags `v*`. Pushes comuns não publicam. Apenas `dist/` é hospedado, sem mapas de código-fonte; o build verifica manifesto, caminhos sob `/ProjetosRpg/` e limite de 500 KB gzip para JS/CSS.

Consulte [arquitetura](docs/ARCHITECTURE.md) e [validação](docs/QA.md).

## Licença

MIT © 2026 Zero. Marcadores implementados na Rulebear com código próprio; Owl Trackers mantém seus próprios nome, identidade e licença.
