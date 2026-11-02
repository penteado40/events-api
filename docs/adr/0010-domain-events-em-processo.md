# Domain events em processo, publicados depois do commit e sem outbox

Contextos avisam uns aos outros sobre fatos por **domain events** desde a V1, e não por chamadas diretas: o `rsvp` publica `RsvpConfirmed` e o `emails` envia a confirmação. Na V1 só esse fluxo precisa disso, mas a V2 traz novos Email kinds (contribuição recebida, lembrete, alteração do evento) que, com eventos, entram como handlers novos no `emails` sem mexer nos contextos que publicam. Consultas entre contextos (ex.: AccessPolicy) continuam como chamada direta ao que o módulo exporta.

A implementação é mínima: a entidade registra o evento, o use case salva e **só depois do commit** publica por um port `EventPublisher`, cujo adaptador em processo roda cada handler dentro de `waitUntil` (ADR-0007) e engole e loga os erros, de modo que um handler nunca derruba a ação. Consideramos um **outbox** (tabela de eventos + worker), que garante a entrega, mas exigiria um job agendado e mais infraestrutura sem ganho real para emails de confirmação, e `@nestjs/event-emitter`, que publica assim que é chamado e não controla `waitUntil`.

## Consequences

- A entrega é de melhor esforço: se a função cair entre o commit e o handler, o evento se perde. Para emails, o Email log e o reenvio manual (PROJ-62) cobrem isso. Se algum fluxo precisar de garantia de entrega (ex.: webhook de PSP na V2), a troca para outbox é um novo adaptador do mesmo port.
- Handlers não podem assumir que rodam antes da resposta HTTP, nem na mesma transação do use case.

## Emenda: pivô para Groups (2026-10-02)

A decisão continua valendo; o exemplo (`RsvpConfirmed` → e-mail de confirmação) saiu com o RSVP (ADR-0016). No modelo novo, os candidatos a domain event são as mudanças num Event e nos Event items, que alimentam as notificações (PROJ-75). Um alerta para o desenho: o Change log (ver a emenda do ADR-0013) não pode ser alimentado por um handler de melhor esforço, porque uma Change perdida apagaria o riscado que alguém deveria ver. Ou ele é gravado na mesma transação da mudança, ou a entrega precisa ser garantida (outbox, como previsto acima).

## Emenda: emails de convite por comando (PROJ-171, 2026-11-01)

O email Activation link não é um handler de domain event: quem cria o Pending user (hoje o `CreateUserUseCase`) chama o `emails` pelo serviço de comandos que ele exporta (`AccountEmails`), por um port próprio (`ActivationLinkMailer`), logo depois das gravações. Assim pede a PRD da primeira fatia da V2 ("acionado pelo comando de quem adiciona"), porque o link também volta na resposta a quem o gerou e o `identity` já está com ele em mãos, e porque a base de domain events só nasce na PROJ-179. O resto da regra continua: o envio roda depois da resposta, dentro de `waitUntil` (`BackgroundTasks`), e uma falha vai para o Email log sem derrubar a ação. Os emails que reagem a fatos (Notifications, PROJ-75) continuam previstos como handlers.
