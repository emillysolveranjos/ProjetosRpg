# Arquitetura da Rulebear 2.3

## Ambiente e dados

React/TypeScript no painel de ação; background persistente enquanto a extensão está ativa na sala. Hospedagem estática em GitHub Pages. SDK Owlbear 3.1.0. Nenhum serviço externo de dados ou autenticação adicional.

A fonte persistente continua em `io.github.samuelsanjos.rulebear/state`, com `schemaVersion: 5`. O nome do namespace legado é intencional para preservar cenas existentes. Estado contém combatentes, ordem/rodada, regras de condições, tipos de dano, presets de defesa, responsáveis, audiências, permissões individuais por ID de jogador, marcadores, modelos, histórico, Undo e IDs dos últimos 100 comandos confirmados.

HP permanece em currentHp/maximumHp. Um marcador com hp=true referencia esses campos, ignorando seus campos numéricos locais. Zod valida limites, unicidade, ordem completa e uma única barra HP. O motor original mantém regras de dano, cura e condições.

Tipos de dano possuem ID estável, nome único por comparação sem acentos/maiúsculas, cor e descrição opcional. Reduções, presets e efeitos de condição referenciam esses IDs. Uma lista vazia em uma redução significa defesa universal. O motor percorre as reduções na ordem do token, acumula os valores correspondentes e aplica cada redução no máximo uma vez por ataque. Presets são modelos; aplicá-los cria uma nova redução com ID próprio no token.

## Acesso e apresentação

Audiências: GM, todos, responsáveis e IDs selecionados. Nome/participação é requisito para apresentar o token ao jogador. Cada ação guarda uma lista de IDs autorizados. Dano, cura, ajustes de HP e condições não exigem responsabilidade; iniciativa e fim do próprio turno exigem. Configurações de marcadores permanecem exclusivas de GM. Tokens invisíveis são retirados da visão de jogadores.

HP atual e máximo são ajustados por comandos separados. Ambos aceitam expressões aritméticas restritas; o máximo deve resultar em inteiro positivo. Alterar o máximo não recorta o HP atual. Permissão de ação e visibilidade são avaliadas separadamente, e respostas, histórico e overlays continuam filtrados.

Filtros são compartilhados entre painel e overlays. Histórico de jogador nunca reutiliza resumos livres antigos, pois podem conter nomes e valores ocultos; apresenta eventos genéricos somente quando o token e seu histórico estão liberados. O badge não revela contagens.

Metadata de cena, itens e jogadores é compartilhada. As restrições são controles de uso normal, não isolamento criptográfico nem proteção contra adulteração por outro código. A prévia de jogador no painel GM é somente leitura.

## Comandos e coordenação

Canal de broadcast `io.github.samuelsanjos.rulebear/v2`. O SDK informa connectionId; o receptor resolve ID e papel usando a lista de participantes, sem confiar no papel enviado no payload. O protocolo de comandos está na versão 5; o canal continua estável para que clientes incompatíveis recebam a orientação de recarregar.

Backgrounds anunciam presença a cada 1,5 segundo. Entre GMs presentes, o menor connectionId é coordenador. Presenças expiram após 6,5 segundos; mudanças de coordenador exigem estabilização de 2,2 segundos e releitura da cena. Uma sessão aleatória distingue reinícios na mesma conexão. Mudanças de papel/conexão atualizam a eleição.

O painel envia ID do comando, cena, revisão observada e sessão do coordenador. Uma fila por coordenador:
1. verifica cena, revisão e recibo;
2. resolve novamente o participante e suas permissões;
3. executa o comando no motor;
4. verifica novamente a cena/revisão/coordenação;
5. salva e somente então confirma.

A revisão é incrementada uma vez por comando. Avançar turno agrega fim/início e Undo em uma única gravação. Comandos simultâneos baseados na mesma revisão: o primeiro confirma; o seguinte é rejeitado como desatualizado. Formulários de acesso, marcadores e defesas conservam sua revisão de abertura.

A confirmação expira em nove segundos. Não há retry automático nem fila offline. Recibos persistentes evitam reaplicar comandos confirmados mesmo após reinício do coordenador. A API não oferece compare-and-swap: controles de eleição e revisão evitam conflitos normais, mas não constituem uma garantia transacional contra partições arbitrárias ou escritores externos.

## Overlays e preferências

Marcadores são itens de `OBR.scene.local`, anexados ao token, sem interceptar cliques. Só itens com o namespace de overlay da Rulebear são removidos durante reconstrução. Atualizações são serializadas e invalidadas em mudanças de geração/cena; inclusão e remoção ocorrem em lotes de até 100.

As coordenadas usam limites atuais do token. Movimento, escala, acesso e papel provocam reconstrução. Preferências ficam no localStorage, indexadas por sala/usuário; exceções usam sceneId/tokenId. Um broadcast de preferência solicita releitura no background, sem gravar estado de combate.

O importador interpreta os quatro tipos do namespace `com.owl-trackers/trackers`. A prévia converte valores, aplica as restrições da Rulebear e permite mapear HP. Não escreve no namespace do Owl Trackers e não mantém sincronização entre extensões.

## Migração e recuperação

Somente o coordenador grava migrações v1, v2, v3 e v4. Primeiro valida e cria um backup JSON no localStorage do mestre, separado por sala e mantendo os backups de cenas anteriores. Se o backup falhar, não grava v5. A exportação no painel permite conservar os dados originais fora do navegador.

Migração v1 cria acesso privado, ordem pela sequência existente, iniciativas nulas e rodada 1 se já havia turno ativo. Em v2/v3, permissões booleanas habilitadas viram listas com os responsáveis atuais; edição antiga da barra HP vira ajuste do atual, e ajuste do máximo começa bloqueado. Categorias textuais de v1–v4 são normalizadas sem acentos ou diferença de maiúsculas. As sete categorias genéricas reutilizam IDs e cores iniciais; as demais recebem ID estável durante a conversão e cor neutra. Combatentes, condições e snapshots de Undo usam a mesma tabela resultante. Reduções existentes continuam nos tokens e a lista de presets começa vazia. Não há downgrade automático; clientes antigos são rejeitados pelo protocolo 5 e recebem orientação para recarregar.

## Referências

- [Metadata compartilhada](https://docs.owlbear.rodeo/extensions/reference/metadata/)
- [Itens locais](https://docs.owlbear.rodeo/extensions/apis/scene/local/)
- [Broadcast e connectionId](https://docs.owlbear.rodeo/extensions/apis/broadcast/)
- [Identificador do Owl Trackers](https://github.com/SeamusFinlayson/owl-trackers/blob/main/src/getPluginId.ts)
