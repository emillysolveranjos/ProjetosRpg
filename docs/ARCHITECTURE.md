# Arquitetura

## Fronteiras

Rulebear é um site estático carregado apenas como extensão do Owlbear Rodeo. Não há servidor próprio, banco de dados, PWA, CLI, .NET, WebAssembly ou modo standalone. A abertura direta da build de produção mostra somente instruções de instalação.

## Entradas

- `action.html`: popover React do GM, projetado para 420 × 700 px.
- `background.html`: registra o menu de contexto e entrega o token escolhido ao popover por metadata privada do jogador.

## Estado

`io.github.samuelsanjos.rulebear/state` em `OBR.scene` contém um documento completo e versionado. Cada alteração parte do último documento observado, incrementa `revision`, passa pela validação Zod e substitui a chave inteira. Eventos de `OBR.scene.onMetadataChange` são aplicados como last-write-wins.

A aplicação não tenta mesclar duas gravações simultâneas. A revisão torna conflitos observáveis, mas a garantia efetiva é a semântica last-write-wins fornecida pela metadata da cena. Isso é adequado ao primeiro lançamento GM-only e mantém a operação previsível em duas janelas.

## Domínio

O diretório `src/domain` não conhece o SDK. Todas as operações recebem um estado imutável e devolvem um novo estado, permitindo testes determinísticos. O adaptador em `src/owlbear` traduz itens, seleção, tema, badge e metadata.

O Undo armazena apenas o fragmento anterior necessário à última ação. O histórico permanece em até 50 entradas e marca a entrada desfeita, em vez de apagar a auditoria.

## Privacidade

A interface consulta o papel atual antes de ler e mostrar o encontro. O menu de contexto filtra `GM`, uma seleção, tipo `IMAGE` e camada `CHARACTER`. Não são solicitadas permissões adicionais no manifesto.
