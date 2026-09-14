# Validação da Rulebear 2.4.0

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
