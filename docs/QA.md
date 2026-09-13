# Validação da Rulebear 2.2.0

## HP máximo e permissões individuais 2.2.0

O estado da cena usa schema v4 e o transporte usa protocolo 4. Cada ação guarda IDs de jogadores autorizados. Dano, cura, ajustes de HP atual/máximo e condições não dependem de responsabilidade; iniciativa e encerramento do próprio turno continuam exigindo que o jogador seja responsável. O HP máximo aceita expressões aritméticas com resultado inteiro positivo e sua alteração preserva o HP atual.

Cenas v1, v2 e v3 são validadas e copiadas para backup antes da migração pelo coordenador. Permissões booleanas antigas são convertidas para os responsáveis atuais, inclusive em snapshots de Undo; edição antiga da barra de HP concede somente o ajuste do HP atual. Clientes de protocolo anterior são rejeitados com orientação para recarregar.

## Correção de alinhamento 2.1.1

Conversão explícita entre o canto superior esquerdo do layout e a âncora inferior central dos Labels (DOWN, sem ponteiro). A compensação de escala da viewport fica limitada a 1 para manter todas as camadas em unidades da cena. Os 18 cenários de regressão verificam as combinações de posição, alinhamento e tamanho com HP parcial, sobrevida e negativo. A geometria do SDK é simulada; a conferência em uma sala real permanece pendente.

## Automatizada

Validação local em 13/09/2026: lint e tipos passaram; 123 testes passaram em 11 arquivos. Build de produção verificado sob /ProjetosRpg/, sem source maps. Auditoria sem ocorrências altas ou críticas.

A suíte cobre:
- regras existentes de dano, cura, reduções, dados, condições e manifesto;
- migração v1/v2/v3 para v4, backup, conversão de permissões e Undo, preservação do original, dados inválidos e versões futuras;
- audiências, responsabilidade, permissões individuais para dois jogadores, ações autorizadas sem responsabilidade, porcentagem e histórico filtrado;
- ajustes separados de HP atual/máximo, expressões inválidas, máximo zero/negativo/fracionário, sobrevida, HP negativo e Undo;
- condições visíveis e ocultas, incluindo aplicar, aumentar/diminuir stacks e remover sem revelar estado aplicado;
- ordem estável, turno/rodada, efeitos combinados, inclusão/remoção e Undo atômico;
- importação dos quatro tipos, mapeamento HP, excesso de marcadores e origem preservada;
- preferências por usuário, sala, cena e token, incluindo migração do formato local antigo e herança parcial;
- fila, comandos simultâneos/desatualizados, deduplicação persistente, falha de escrita, remetente forjado, mudança de cena, eleição, troca de coordenador e ausência de mestre;
- migração bloqueada quando backup falha; confirmação expirada sem repetição;
- painel GM/jogadores, prévia, mudança de papel, revogação e preferências offline;
- overlays locais, HP único, porcentagem, posição vertical, alinhamento horizontal, três tamanhos, movimento/escala, tokens ocultos e preservação de itens de outras extensões.

Redesenho compacto: verificação adicional em Chrome headless isolado via DevTools Protocol, sem controle do navegador do usuário. Painel e diálogo de acesso mediram exatamente 320 e 420 px sem rolagem horizontal. Os cartões de permissão exibiram separadamente dano, HP atual e HP máximo e não apresentaram a permissão antiga “Editar HP”. O servidor temporário foi encerrado e a porta 5174 confirmada como livre.

A suíte adicional cobre agrupamento de eventos, IDs estáveis e ausência de gravações de overlays em mudanças apenas de revisão, recuperação de falha de escrita, troca de cena, layout circular/arredondado e quebra de linha de valores longos. Nenhuma dependência foi acrescentada.

Os testes de SDK e múltiplos participantes usam transporte e cenas simulados. Não substituem uma sessão real de navegador.

## Pendências de validação em sala real

A pedido do usuário, esta implementação não usa controle do computador. O teste headless usa dados simulados; a conferência visual dos marcadores no mapa e as sessões reais abaixo permanecem pendentes:

1. Recarregar a versão pública em uma sala de teste com um GM e dois jogadores distintos.
2. Adicionar tokens, atribuir responsáveis e conceder permissões diferentes a dois jogadores; conferir visões diferentes, porcentagem, condições e histórico.
3. Aplicar dano/cura, ajuste atual, ajuste máximo e operações de condição, inclusive com HP e condições ocultos. Fechar o painel GM e verificar que o background continua atendendo.
4. Ordenar iniciativa, permitir fim de turno ao jogador ativo e testar Undo de efeitos de fim/início.
5. Combinar acima/abaixo, esquerda/centro/direita e pequeno/médio/grande entre participantes e tokens; verificar escala, rotação, movimento, recarga, troca de cena e visibilidade/neblina.
6. Importar Owl Trackers, revisar cores/valores e desativá-lo na sala após conferir.
7. Desconectar o coordenador, testar sucessão por outro GM e bloquear alterações quando todos os GMs saírem.
8. Conferir migração de cópias reais de cenas v1/v2/v3 e baixar o backup.

## Dependências

A auditoria atual encontra duas ocorrências moderadas transitivas na cadeia SDK → uuid, relativas a GHSA-w5hq-g745-h8pq; não há correção disponível informada pelo npm para essa cadeia. Nenhuma dependência foi acrescentada nesta ampliação. A publicação exige ausência de ocorrências altas ou críticas.

## Publicação

A versão 2.2.0 foi publicada com sucesso pelo workflow manual da branch `main`. Manifesto, action.html, background.html, icon.svg, action-icon.svg e todos os JS/CSS referenciados responderam por HTTPS sob `/ProjetosRpg/`; o pacote não contém source maps nem node_modules.

Rollback do código não converte cenas v4 para versões anteriores; preserve/exporte os backups antes de uma recuperação.
