# Validação da Rulebear 2.3.0

## Biblioteca de combate

O estado da cena usa schema v5 e o transporte usa protocolo 5. A Biblioteca reúne condições, tipos de dano e presets de defesa. Cenas novas recebem sete tipos editáveis: Físico, Fogo, Gelo, Elétrico, Veneno, Psíquico e Mágico.

Ataques, reduções e efeitos automáticos referenciam IDs de tipos. Uma defesa sem tipos é universal; reduções correspondentes são cumulativas, seguem a ordem do token e são aplicadas uma única vez por ataque. Aplicar um preset cria uma cópia independente. Tipos referenciados por presets, tokens ou condições não podem ser excluídos.

Cenas v1, v2, v3 e v4 são validadas e copiadas para backup antes da migração pelo coordenador. Categorias antigas equivalentes reutilizam os tipos genéricos sem diferenciar acentos ou maiúsculas. Categorias próprias viram tipos editáveis com cor neutra. Combatentes, condições e snapshots de Undo passam a compartilhar os mesmos IDs. Clientes de protocolo anterior são rejeitados com orientação para recarregar.

## Automatizada

Validação local em 13/09/2026:

- lint e tipos passaram;
- 130 testes passaram em 11 arquivos;
- build público verificado sob `/ProjetosRpg/`, sem source maps;
- manifesto e recursos compilados validados;
- auditoria sem ocorrências altas ou críticas.

A suíte cobre:

- criação, edição, nomes equivalentes, referências inválidas e exclusão protegida de tipos de dano;
- presets aplicados como cópias independentes e preservados após editar ou excluir o original;
- dano sem tipo, com um ou vários tipos, defesa universal, correspondências múltiplas e ordem cumulativa;
- efeitos de condição com tipos, dano, cura e defesas;
- migração v1–v4 para v5, categorias genéricas e próprias, backup, Undo e preservação do original;
- regras existentes de HP negativo, sobrevida, cura, ajustes de HP atual/máximo, dados e condições;
- audiências, responsabilidade, permissões individuais, informações ocultas e histórico filtrado;
- iniciativa, turno, rodada, comandos simultâneos, deduplicação, reconexão e troca de coordenador;
- importação do Owl Trackers, marcadores locais e preferências por usuário, sala, cena e token;
- abertura da Biblioteca, navegação pelas três abas e apresentação dos sete tipos iniciais.

Chrome headless isolado, sem controle do navegador do usuário, mediu o painel e o diálogo da Biblioteca em 320 e 420 px. Em ambos, `scrollWidth` coincidiu com `clientWidth`; não houve rolagem horizontal. O servidor e o Chrome temporários foram encerrados, e as portas 4174, 4175, 5174 e 9225 ficaram livres.

Os testes de SDK e múltiplos participantes usam transporte e cenas simulados. Não substituem uma sessão real do Owlbear Rodeo.

## Pendências de validação em sala real

1. Recarregar a versão 2.3.0 em uma sala de teste com um GM e dois jogadores distintos.
2. Criar, editar e excluir tipos e presets; confirmar as mensagens de referência antes de excluir um tipo em uso.
3. Aplicar um preset a um token, editar a cópia e confirmar que o modelo original não muda.
4. Aplicar ataques sem tipo, com um tipo e com vários tipos; conferir defesa universal, ordem e redução única por defesa.
5. Criar uma condição com dano tipado e confirmar sua interação com as defesas no avanço de turno e no Undo.
6. Conferir visibilidade e permissões de GM/jogadores no painel, mapa, histórico, notificações e prévia.
7. Abrir a Biblioteca e os formulários em painéis reais estreitos, incluindo 320 e 420 px.
8. Conferir migração usando cópias reais de cenas v1–v4 e baixar o backup.

## Dependências

A auditoria encontra duas ocorrências moderadas transitivas na cadeia SDK → `uuid`, relativas a GHSA-w5hq-g745-h8pq. O npm informa que não há correção disponível nessa cadeia. Nenhuma dependência foi acrescentada nesta versão. A exigência de ausência de ocorrências altas ou críticas foi atendida.

## Publicação

A versão 2.3.0 está preparada localmente. Não houve push, tag ou deploy nesta etapa. A versão pública permanece 2.2.0 até a execução manual do workflow do GitHub Pages.

Depois da publicação, validar `manifest.json`, `action.html`, `background.html`, ícones e recursos JS/CSS por HTTPS sob `/ProjetosRpg/`. Rollback do código não converte cenas v5 para versões anteriores; preserve ou exporte os backups antes de uma recuperação.
