# Validação da Rulebear 2.6.0

## Design nativo do Owlbear, sigla e descrição dos marcadores (2.6.0)

Schema v6 sem migração; protocolo sobe para 7, porque coordenadores 2.5 descartariam os campos novos dos marcadores ao validar.

- O painel usa a paleta do tema do Owlbear (`OBR.theme`), fundo transparente dentro do popover, fonte do sistema e ícones Material, seguindo as extensões oficiais Initiative Tracker e Dice.
- A altura do popover acompanha o conteúdo (`OBR.action.setHeight`), com 700 px quando há uma janela aberta.
- Marcadores aceitam sigla no mapa (até 5 caracteres, como `CA 15`) e descrição (até 200), exibida como dica e nos detalhes do cartão, respeitando a audiência do marcador.
- Menu do token **Abrir na Rulebear** para todos os papéis: mostra o cartão; para o mestre, oferece adicionar tokens novos. Jogadores sem acesso recebem aviso genérico.
- Clicar no retrato centraliza a câmera no token (e seleciona, para o mestre).
- Textos auxiliares passaram a ter no mínimo 10–11 px.
- Prévia do mapa sem o Owlbear (`npm run preview:map`): sete grupos de cenários com tokens e mapas próprios, desenhando as mesmas etiquetas enviadas ao SDK.
- Marcadores no mapa, corrigidos a partir da prévia: alinhamento encostado por dentro do token (antes invadia o vizinho), linhas de bolinhas alinhadas, medida de texto por caractere (duas siglas cabem por linha numa célula), no máximo duas linhas sobre a arte, cores de saúde na barra de HP com tons escuros para o texto branco e marcação desligada com fundo escuro e `◯`.

Validação local em 18/10/2026: lint e tipos passaram; 162 testes passaram em 15 arquivos; build público verificado. Painel conferido no modo de demonstração nos temas escuro e claro em 420 px.

## Validação anterior (2.5.0)

### Praticidade e design do painel

Mudanças somente de interface; schema v6 e protocolo 6 não mudaram, então salas em 2.4.0 continuam compatíveis.

- Dano/cura rápidos na barra de HP: Enter aplica dano (com dados e tipo opcional), Shift+Enter aplica cura, foco mantido; dano avançado e ajustes ficam recolhidos.
- Iniciativa editável no cartão, com Enter/Tab avançando ao próximo combatente e aviso **Ordenar agora** antes do início.
- Cartões em uma linha, barra de HP colorida por saúde quando usa a cor padrão, estado **CAÍDO**, destaque e nome de quem está na vez, dica do Undo e rodapé uniforme.
- O modo de demonstração mantém a presença do coordenador simulado.

Validação local em 05/10/2026: lint e tipos passaram; 150 testes passaram em 13 arquivos; build público verificado. Fluxos de dano, cura, iniciativa, ordenação, início de turno, HP negativo e tema claro conferidos no modo de demonstração em 400 e 320 px. A visão do jogador foi coberta pelos testes automatizados.

O lockfile atualiza `brace-expansion` (dependência de desenvolvimento via ESLint) para eliminar a ocorrência alta GHSA-q2hr-2g5m-vwhr; restam apenas as duas moderadas conhecidas da cadeia SDK → `uuid`.

## Validação anterior (2.4.0)

## Imunidade e penetração

O estado da cena usa schema v6 e o transporte usa protocolo 6. Ataques e efeitos de condições aceitam componentes separados, cada um com expressão, tipo, imunidade e penetração de RD independentes.

Defesas e presets podem representar redução fixa ou imunidade. Imunidade bloqueia somente os componentes cobertos; RDs correspondentes são somadas uma vez por componente e recebem a penetração rolada daquela linha. Uma defesa sem tipos é universal. Aplicar um preset continua criando uma cópia independente.

Cenas v1 a v5 são validadas e copiadas para backup antes da migração pelo coordenador. Defesas antigas tornam-se RDs; bypass antigo passa a ignorar somente imunidade. Componentes antigos com vários tipos permanecem híbridos. Clientes de protocolo anterior são rejeitados com orientação para recarregar.

## Automatizada

Validação local em 14/09/2026, no repositório principal:

- lint e tipos passaram;
- 144 testes passaram em 12 arquivos;
- build público verificado sob `/ProjetosRpg/`, sem source maps;
- manifesto e recursos compilados validados;
- auditoria sem ocorrências altas ou críticas.

A suíte cobre:

- criação, edição, nomes equivalentes, referências inválidas e exclusão protegida de tipos de dano;
- presets aplicados como cópias independentes e preservados após editar ou excluir o original;
- dano sem tipo, ataques mistos, imunidade específica/universal e componentes híbridos;
- penetração fixa ou em dados abaixo, igual e acima da RD, combinada com imunidade ignorada;
- efeitos de condição com múltiplos componentes, imunidade e penetração;
- migração v1–v5 para v6, backup, Undo e preservação do original;
- regras existentes de HP negativo, sobrevida, cura, ajustes de HP atual/máximo, dados e condições;
- audiências, responsabilidade, permissões individuais, informações ocultas e histórico filtrado;
- iniciativa, turno, rodada, comandos simultâneos, deduplicação, reconexão e troca de coordenador;
- importação do Owl Trackers, marcadores locais e preferências por usuário, sala, cena e token;
- abertura da Biblioteca, navegação pelas três abas e apresentação dos sete tipos iniciais.

Chrome headless isolado, com perfil temporário, conferiu presets, condições com múltiplos componentes, formulário de ataque e histórico detalhado em 320 e 420 px no modo de demonstração do servidor de desenvolvimento. Não houve rolagem horizontal. Um ataque de dois componentes foi executado e seus dois detalhes apareceram no histórico. A captura de 320 px foi inspecionada. A tentativa anterior na build de produção não validava esses controles, porque o modo de demonstração é desativado nessa build.

Regressões adicionais verificam preservação dos detalhes após serialização e Undo, ocultação ao retirar acesso às defesas/HP/condições e rejeição de penetração inválida mesmo quando o componente é bloqueado por imunidade.

Os testes de SDK e múltiplos participantes usam transporte e cenas simulados. Não substituem uma sessão real do Owlbear Rodeo.

## Pendências de validação em sala real

1. Recarregar a versão 2.4.0 em uma sala de teste com um GM e dois jogadores distintos.
2. Criar, editar e excluir tipos e presets; confirmar as mensagens de referência antes de excluir um tipo em uso.
3. Aplicar um preset a um token, editar a cópia e confirmar que o modelo original não muda.
4. Aplicar ataque misto com componente imune e outro reduzido; conferir cada resultado e o Undo.
5. Combinar **Ignorar imunidade** e uma expressão de **Ignorar RD** como mestre e como jogador autorizado.
6. Conferir visibilidade e permissões de GM/jogadores no painel, mapa, histórico, notificações e prévia.
7. Abrir a Biblioteca e os formulários em painéis reais estreitos, incluindo 320 e 420 px.
8. Conferir migração usando cópias reais de cenas v1–v5 e baixar o backup.

## Dependências

A auditoria encontra duas ocorrências moderadas transitivas na cadeia SDK → `uuid`, relativas a GHSA-w5hq-g745-h8pq. O npm informa que não há correção disponível nessa cadeia. Nenhuma dependência foi acrescentada nesta versão. A exigência de ausência de ocorrências altas ou críticas foi atendida.

## Publicação

A versão 2.4.0 passou pelas verificações locais e segue para o workflow manual autorizado pelo usuário. A confirmação de publicação deve identificar o commit e a execução do GitHub Actions; a preparação local, sozinha, não confirma o deploy.

Depois da publicação, validar `manifest.json`, `action.html`, `background.html`, ícones e recursos JS/CSS por HTTPS sob `/ProjetosRpg/`. Rollback do código não converte cenas v6 para versões anteriores; preserve ou exporte os backups antes de uma recuperação.
