# Rulebear

Extensão do [Owlbear Rodeo](https://www.owlbear.rodeo/) para mestres e jogadores: iniciativa, HP, dano, cura, defesas, condições e marcadores visíveis nos tokens.

## Instalar ou atualizar

1. No perfil do Owlbear, abra **Extensions → Add Extension**.
2. Cole [o link de instalação](https://emillysolveranjos.github.io/ProjetosRpg/manifest.json).
3. Na sala, habilite **Rulebear** em **Extensions** e abra o botão do urso.
4. Se já estava instalada, recarregue a sala em todos os participantes para carregar a versão 2.7.0. A 2.7.0 muda o protocolo de comunicação: versões anteriores na mesma sala ficam bloqueadas até recarregar.

Sem servidor local, conta GitHub ou login adicional. Distribuição por link; não está na loja do Owlbear. Desative instalações locais antigas na sala para não executar duas versões sobre o mesmo encontro.

## Preparar a mesa

- Como mestre, selecione um token da camada **Personagem** e clique em **+ Token selecionado**, ou clique com o botão direito no token e escolha **Abrir na Rulebear**.
- Abra **⋯ no cartão → Acesso**. Atribua os responsáveis, libere nome/participação e marque, no cartão de cada jogador, quais ações ele pode executar.
- Abra **Marcadores** para configurar HP e até 11 recursos adicionais. Cada marcador tem nome, cor, audiência, exibição e permissão de edição.
- Use **Engrenagem → Ver como** para conferir a visão de um jogador, sem executar ações por ele.
- Todas as informações começam restritas aos mestres. Ser responsável pelo token não concede acesso automaticamente.
- Os jogadores entram usando a mesma extensão e veem somente o que foi liberado na interface. Ações permitidas são aplicadas diretamente, sem aprovação a cada clique.

**Visibilidade não é sigilo técnico:** todos os dados ficam na metadata compartilhada da cena. A Rulebear filtra a interface; ferramentas de desenvolvimento e outras extensões podem consultar esses dados.

## Iniciativa e turnos

Clique no quadrado de iniciativa à esquerda do cartão (**INI** quando vazio) e digite o valor. **Enter** ou **Tab** salva e já abre a iniciativa do próximo combatente; **Esc** cancela. Alterar um valor não reorganiza automaticamente o encontro: antes de iniciar, o painel avisa quando há iniciativas fora de ordem e oferece **Ordenar agora**. O mesmo comando fica em **⋯ do encontro → Ordenar iniciativa**, e os botões de ordem do cartão resolvem empates.

**Iniciar** abre a rodada 1. **Próximo →** executa os efeitos de fim do participante atual e início do próximo em uma única operação. Ao completar a fila, a rodada aumenta. O dono do token ativo pode encerrar o turno se o mestre permitir.

Novos combatentes entram no fim. Remover o ativo pausa o encontro; o mestre escolhe em qual token retomar. **Undo**, exclusivo dos mestres, restaura a última operação e seus efeitos sobre HP, condições, ordem e rodada.

Dano aceita até 12 componentes, como `10 Físico + 1d6 Fogo`. Cada componente resolve separadamente imunidade e RD. **Ignorar imunidade** permite que aquela parcela atravesse imunidades; **Ignorar RD** aceita um número ou dados, como `3` ou `1d6+2`, e desconta o resultado da RD total aplicável. As duas opções podem ser usadas juntas por qualquer jogador autorizado a aplicar dano. O dano pode levar o HP abaixo de zero. Cura soma a partir do valor negativo e para no HP máximo; se o token já tiver sobrevida, a cura preserva esse valor. Iniciativa não possui rolagem nesta versão.

## Histórico

Cada ação vira um cartão com ícone e cor por tipo e uma frase direta: **Goblin levou 9 de dano**, **Lina recuperou 5 de HP**, **Vez de Urso-coruja · Rodada 2**, **Goblin recebeu Sangrando**. Os dados aparecem como peças, por exemplo `🎲 2d6+3 → [4] [5] +3 = 12 · defesa −2`, com o HP antes e depois. No avanço de turno, o cartão mostra quem começa a vez e, embaixo, quem terminou e os efeitos das condições. Ações desfeitas ficam riscadas. Rolagens com mais de 20 dados guardam só os 20 primeiros e o total.

Jogadores veem os acontecimentos dos tokens liberados para eles. Números de dano, cura e HP só aparecem para quem vê o HP completo (e as defesas, no caso de dano); sem esse acesso, o cartão diz apenas que o token levou dano ou recuperou HP. Condições ocultas não aparecem.

## Biblioteca da cena

Abra **📚 Biblioteca** no rodapé do painel do mestre. As três abas guardam regras reutilizáveis na cena:

- **Condições** reúne stacks, duração e efeitos automáticos. Efeitos de dano usam os mesmos componentes, imunidades e expressões de penetração dos ataques manuais.
- **Tipos de dano** começa com Físico, Fogo, Gelo, Elétrico, Veneno, Psíquico e Mágico. Você pode editar cores e descrições ou criar tipos próprios. Um tipo em uso só pode ser excluído depois que suas referências forem removidas.
- **Presets de defesa** guarda reduções fixas ou imunidades e seus tipos afetados. Uma defesa sem tipos é universal.

Em **Defesas** no cartão do token, escolha um preset e clique em **Adicionar ao token**, ou crie uma defesa manual. A cópia aplicada pertence ao token: editar ou excluir o preset original não a altera. Imunidade zera apenas os componentes cobertos; as RDs correspondentes são somadas uma vez por componente antes da penetração. **Salvar como preset** transforma uma defesa do token em um novo modelo reutilizável.

## Painel compacto

Clique na **barra de HP** e digite o valor: **Enter** aplica dano (aceita dados, como `2d6+3`, e um tipo opcional) e **Shift+Enter** aplica cura. O campo continua focado para encadear valores. **Dano avançado** abre os componentes múltiplos, imunidade e RD; **Ajustar HP atual ou máximo** abre os ajustes, com campos e permissões independentes. Clique nos demais recursos para editá-los.

Com a cor padrão, a barra de HP no painel e no mapa fica verde acima de 50%, amarela até 25% e vermelha abaixo disso; cores escolhidas pelo mestre são mantidas. Tokens com HP 0 ou negativo aparecem como **CAÍDO**. O topo mostra a rodada e de quem é a vez, e o botão de desfazer indica qual ação será desfeita. Alterar o máximo preserva o HP atual, inclusive valores negativos e sobrevida. Só aparecem ações autorizadas. Os detalhes de um único cartão ficam abertos por vez.

O mestre concede individualmente **Informar iniciativa**, **Aplicar dano**, **Aplicar cura**, **Ajustar HP atual**, **Ajustar HP máximo**, **Alterar condições** e **Encerrar o próprio turno**. Dano, cura, ajustes e condições não exigem responsabilidade pelo token; iniciativa e encerramento exigem. O token precisa estar visível no painel do jogador. As ações continuam disponíveis com HP em porcentagem ou oculto, sem revelar o resultado exato. Se condições estiverem ocultas, o jogador autorizado escolhe a definição e a operação sem ver condições aplicadas, stacks ou duração.

O botão **⋯ no cartão** reúne condições, defesas e, recolhidos, a posição dos marcadores na sua tela e a seção **Ordem, acesso e marcadores** do mestre. Configurações completas continuam em janelas próprias. A confirmação de salvamento aparece brevemente no rodapé. A prévia do jogador é somente leitura e tem **Voltar ao mestre**.

## Marcadores e posição

No mapa, HP aparece como uma barra arredondada junto à borda do token, com o valor centralizado dentro dela; no mapa, verde e amarelo usam tons mais escuros para o texto branco continuar legível. Números e contadores ficam em círculos ou cápsulas voltados para a imagem, em até duas linhas centralizadas (ou encostadas à esquerda/direita, conforme o alinhamento); o que passar disso vai para fora do token, depois das barras. Marcações desligadas aparecem com fundo escuro e `◯`. O alinhamento encosta o conjunto na borda escolhida por dentro do token, sem invadir o vizinho da grade; no tamanho médio a barra ocupa toda a largura e o alinhamento move as bolinhas. O conjunto acompanha a posição vertical, o alinhamento horizontal, o tamanho e a visibilidade escolhidos por cada participante.

Quatro tipos: **barra atual/máximo**, **número**, **contador** e **marcação**. A barra de HP usa os próprios valores do combate; não existe um segundo HP.

Cada marcador aceita uma **sigla no mapa** (até 5 caracteres) e uma **descrição** (até 200). A sigla aparece antes do valor na bolinha do token, como `CA 15`, para quem olha o mapa saber o que o número representa. A descrição aparece ao passar o mouse no marcador do painel e fica escrita nos detalhes do cartão, o que também funciona no celular. Quem não vê o marcador não vê a sigla nem a descrição.

**Abrir na Rulebear**, no menu do botão direito de um token, abre o painel no cartão daquele token para qualquer participante. Para o mestre, um token que ainda não está no encontro abre a janela de adicionar. Clicar no retrato do cartão centraliza a câmera no token.

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

Cenas v1 a v5 são migradas para v6 por um mestre, preservando HP, defesas, condições, histórico, turno, marcadores e Undo compatível. Defesas anteriores tornam-se reduções fixas. A antiga opção `Ignorar defesas` em condições passa a significar somente `Ignorar imunidade`, sem conceder penetração de RD. Componentes antigos com vários tipos permanecem híbridos e só são bloqueados quando imunidades cobrem todos os tipos. Categorias antigas equivalentes reutilizam os sete tipos iniciais; categorias próprias viram tipos editáveis de cor neutra. Antes da conversão, o navegador do mestre guarda um backup. Exporte-o pela engrenagem em **Baixar backups anteriores à migração**. Todos os participantes devem recarregar a Rulebear após a atualização.

Dados inválidos ou versões futuras não são substituídos. Limites: 50 combatentes, 12 marcadores por token, 25 definições de condição, 50 tipos de dano, 50 presets de defesa, 12 componentes por ataque ou condição, 12 tipos por defesa, 25 modelos e 50 registros de histórico.

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

**Prévia do mapa sem o Owlbear:** `npm run preview:map` gera capturas em `artifacts/map-preview/` (uma por grupo: HP, tipos de marcador, posição, tamanhos de token e vizinhos, visão do jogador, contraste com o mapa e zoom). Use `npm run preview:map -- hp tokens` para gerar só alguns grupos. A página interativa fica em `http://localhost:5174/map-preview.html` com `npm run dev`. Ela desenha as mesmas etiquetas que a Rulebear envia ao Owlbear, sobre tokens e mapas de exemplo próprios, e não entra no build publicado. Requer Chrome ou Edge; defina `CHROME_PATH` se o navegador estiver em outro caminho.

Desenvolvimento: `http://localhost:5174/manifest.json`. O hostname `localhost` é necessário para a política CSP observada no Owlbear. O modo de demonstração `/action.html?mock=1` (ou `&role=player`) existe somente em desenvolvimento.

O CI verifica pushes e pull requests. Publicação é manual em **Actions → Publicar GitHub Pages → Run workflow**, ou por tags `v*`. Pushes comuns não publicam. Apenas `dist/` é hospedado, sem mapas de código-fonte; o build verifica manifesto, caminhos sob `/ProjetosRpg/` e limite de 500 KB gzip para JS/CSS.

Consulte [arquitetura](docs/ARCHITECTURE.md) e [validação](docs/QA.md).

## Licença

MIT © 2026 Zero. Marcadores implementados na Rulebear com código próprio; Owl Trackers mantém seus próprios nome, identidade e licença.
