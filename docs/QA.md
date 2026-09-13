# Validação da Rulebear 2.1.0

## Automatizada

Validação local em 13/09/2026: lint e tipos passaram; 97 testes passaram em 11 arquivos. Build de produção verificado sob /ProjetosRpg/, sem source maps. Auditoria sem ocorrências altas ou críticas.

A suíte cobre:
- regras existentes de dano, cura, reduções, dados, condições e manifesto;
- migração v1, preservação do original, restrições iniciais, dados inválidos e versões futuras;
- audiências, responsabilidade, ações autorizadas, porcentagem e histórico filtrado;
- ordem estável, turno/rodada, efeitos combinados, inclusão/remoção e Undo atômico;
- importação dos quatro tipos, mapeamento HP, excesso de marcadores e origem preservada;
- preferências por usuário, sala, cena e token, incluindo migração do formato local antigo e herança parcial;
- fila, comandos simultâneos/desatualizados, deduplicação persistente, falha de escrita, remetente forjado, mudança de cena, eleição, troca de coordenador e ausência de mestre;
- migração bloqueada quando backup falha; confirmação expirada sem repetição;
- painel GM/jogadores, prévia, mudança de papel, revogação e preferências offline;
- overlays locais, HP único, porcentagem, posição vertical, alinhamento horizontal, três tamanhos, movimento/escala, tokens ocultos e preservação de itens de outras extensões.

Redesenho compacto: verificação adicional em Edge headless isolado, sem controle do navegador do usuário. Painel em 320 e 420 px sem rolagem horizontal, cartões recolhidos abaixo de 140 px, dano/cura pelo gateway de demonstração e prévia sem ações. A validação desta revisão também conferiu os três seletores globais, as três exceções por token, persistência local e ausência de overflow nas duas larguras. Servidor temporário encerrado após o teste.

A suíte adicional cobre agrupamento de eventos, IDs estáveis e ausência de gravações de overlays em mudanças apenas de revisão, recuperação de falha de escrita, troca de cena, layout circular/arredondado e quebra de linha de valores longos. A versão 2.1.0 também cobre HP negativo, sobrevida acima do máximo, cura a partir de negativos, efeitos de condição, importação, Undo, migração v1/v2 para v3 e rejeição do protocolo antigo. Nenhuma dependência foi acrescentada.

Os testes de SDK e múltiplos participantes usam transporte e cenas simulados. Não substituem uma sessão real de navegador.

## Pendências de validação em sala real

A pedido do usuário, esta implementação não usa controle do computador. O teste headless usa dados simulados; a conferência visual dos marcadores no mapa e as sessões reais abaixo permanecem pendentes:

1. Recarregar a versão pública em uma sala de teste com um GM e dois jogadores distintos.
2. Adicionar tokens e atribuir responsáveis; conferir visões diferentes, porcentagem, condições e histórico.
3. Aplicar dano/cura e ajustes simultâneos. Fechar o painel GM e verificar que o background continua atendendo.
4. Ordenar iniciativa, permitir fim de turno ao jogador ativo e testar Undo de efeitos de fim/início.
5. Combinar acima/abaixo, esquerda/centro/direita e pequeno/médio/grande entre participantes e tokens; verificar escala, rotação, movimento, recarga, troca de cena e visibilidade/neblina.
6. Importar Owl Trackers, revisar cores/valores e desativá-lo na sala após conferir.
7. Desconectar o coordenador, testar sucessão por outro GM e bloquear alterações quando todos os GMs saírem.
8. Conferir migração de uma cópia de cena v1 e baixar o backup.

## Dependências

A auditoria atual encontra duas ocorrências moderadas transitivas na cadeia SDK → uuid, relativas a GHSA-w5hq-g745-h8pq; não há correção disponível informada pelo npm para essa cadeia. Nenhuma dependência foi acrescentada nesta ampliação. A publicação exige ausência de ocorrências altas ou críticas.

## Publicação

Esta revisão está preparada localmente, ainda sem publicação. O workflow manual precisa terminar com sucesso. Conferir por HTTPS manifesto 2.1.0, action.html, background.html, icon.svg, action-icon.svg e os JS/CSS referenciados sob /ProjetosRpg/. O pacote hospedado não deve conter source maps nem node_modules.

Rollback do código não converte cenas v3 para versões anteriores; preserve/exporte os backups antes de uma recuperação.
