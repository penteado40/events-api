# Domain events em processo, publicados depois do commit e sem outbox

Contextos avisam uns aos outros sobre fatos por **domain events** desde a V1, e não por chamadas diretas: o `rsvp` publica `RsvpConfirmed` e o `emails` envia a confirmação. Na V1 só esse fluxo precisa disso, mas a V2 traz novos Email kinds (contribuição recebida, lembrete, alteração do evento) que, com eventos, entram como handlers novos no `emails` sem mexer nos contextos que publicam. Consultas entre contextos (ex.: AccessPolicy) continuam como chamada direta ao que o módulo exporta.

A implementação é mínima: a entidade registra o evento, o use case salva e **só depois do commit** publica por um port `EventPublisher`, cujo adaptador em processo roda cada handler dentro de `waitUntil` (ADR-0007) e engole e loga os erros, de modo que um handler nunca derruba a ação. Consideramos um **outbox** (tabela de eventos + worker), que garante a entrega, mas exigiria um job agendado e mais infraestrutura sem ganho real para emails de confirmação, e `@nestjs/event-emitter`, que publica assim que é chamado e não controla `waitUntil`.

## Consequences

- A entrega é de melhor esforço: se a função cair entre o commit e o handler, o evento se perde. Para emails, o Email log e o reenvio manual (PROJ-62) cobrem isso. Se algum fluxo precisar de garantia de entrega (ex.: webhook de PSP na V2), a troca para outbox é um novo adaptador do mesmo port.
- Handlers não podem assumir que rodam antes da resposta HTTP, nem na mesma transação do use case.
