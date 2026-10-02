# QStash para o envio agrupado de notificações (PROJ-116)

Pesquisa feita em 2026-10-02, em fontes primárias (docs do Upstash e da Vercel, código do `qstash-js`, docs do NestJS). Cada afirmação traz o link da fonte. Onde a doc não fala nada, o texto diz isso.

**Contexto.** Quando a produção edita um Event publicado, os integrantes recebem uma notificação agrupada. O envio é automático 10 min depois da última edição, com teto de 30 min contados da primeira edição pendente, ou acontece na hora com "notificar agora". A proposta usa como timer uma mensagem atrasada no QStash, com checagem e reagendamento na entrega. A API roda em Vercel Functions, com Upstash Redis (ADR-0007), e os domain events são publicados depois do commit via `waitUntil` (ADR-0010).

---

## 1. Mensagem com atraso

| Item | O que a doc diz | Fonte |
| --- | --- | --- |
| Como atrasar | `Upstash-Delay: <número><unidade>` (ex.: `10m`) ou `Upstash-Not-Before: <unix timestamp em segundos, UTC>`. Se vierem os dois, o `Not-Before` vence. | [Delay](https://upstash.com/docs/qstash/features/delay), [Publish](https://upstash.com/docs/qstash/api-reference/messages/publish-a-message) |
| Atraso máximo | Free: **7 dias**. Pay as you go: **1 ano**. Fixed: sem limite. | [Delay](https://upstash.com/docs/qstash/features/delay), [Pricing](https://upstash.com/pricing/qstash) |
| Precisão | O `Not-Before` tem granularidade de **segundo**. A doc **não publica SLA** de pontualidade da entrega. | [Delay](https://upstash.com/docs/qstash/features/delay) |
| Custo | Pay as you go: **US$ 1 a cada 100 mil mensagens**, com banda grátis até 50 GB/mês. **Cada tentativa de entrega conta como uma mensagem**, retentativas incluídas. | [Pricing](https://upstash.com/pricing/qstash) |
| Plano gratuito | **1.000 mensagens/dia**, mensagem de até 1 MB, paralelismo máximo 10, DLQ e logs guardados por 3 dias, resposta HTTP de até 15 min, 10 schedules ativos. | [Pricing](https://upstash.com/pricing/qstash) |

Para nós: 10 a 30 min fica muito abaixo do limite de 7 dias. O orçamento do plano gratuito é de mensagens, não de Events. Cada Event com edição gera de 1 a 4 mensagens (veja a seção 3), mais as retentativas.

## 2. Deduplicação e cancelamento

### Deduplicação

- `Upstash-Deduplication-Id: <id>` faz a deduplicação explícita. `Upstash-Content-Based-Deduplication: true` gera o id a partir do destino, do corpo e dos headers repassados. ([Deduplication](https://upstash.com/docs/qstash/features/deduplication))
- **A janela é de 10 minutos.** Depois disso, o mesmo id ou o mesmo conteúdo pode ser publicado de novo. ([Deduplication](https://upstash.com/docs/qstash/features/deduplication))
- A duplicata é "accepted by QStash but not enqueued". A resposta devolve o `messageId` original, com `deduplicated: true`. ([Deduplication](https://upstash.com/docs/qstash/features/deduplication), [Publish](https://upstash.com/docs/qstash/api-reference/messages/publish-a-message))

**Conclusão: a deduplicação do QStash não garante sozinha uma única mensagem pendente por Event.** A janela de 10 min coincide com o nosso atraso de 10 min, e o reagendamento pode estender o ciclo até 30 min. Um `Deduplication-Id = eventId` fixo deixaria passar uma segunda mensagem depois de 10 min. Pior: poderia engolir o reagendamento legítimo feito na entrega, se ele caísse dentro da janela. A deduplicação serve como **rede de proteção contra publicação duplicada do mesmo agendamento** (retry do `waitUntil`, duas requisições concorrentes). Para isso, o id deve incluir o horário-alvo, por exemplo `notify:<eventId>:<dueAtEpoch>`. A garantia de "um ciclo pendente por Event" fica no nosso banco (seção 3).

### Cancelamento

- A API é `DELETE /v2/messages/{messageId}`, que responde `202 {"cancelled": 1}`, ou 404 se a mensagem não existe. ([Cancel a message](https://upstash.com/docs/qstash/api-reference/messages/cancel-a-message)) No SDK TS: `client.messages.cancel(id | id[] | { all: true })`. ([SDK TS, messages](https://upstash.com/docs/qstash/sdks/ts/examples/messages))
- O cancelamento é assíncrono: "When the request is received, `CANCEL_REQUESTED` will be logged first. If retries are not exhausted yet, in the next deliver time, the message will be marked as `CANCELLED`". ([Debug logs](https://upstash.com/docs/qstash/howto/debug-logs))
- A entrega é "at least once", com "a very small chance" de executar duas vezes. ([Workflow troubleshooting](https://upstash.com/docs/workflow/troubleshooting/general))

**Conclusão:** dá para cancelar, mas o handler precisa ser idempotente de qualquer jeito. Com o handler idempotente, o cancelamento vira otimização opcional (por exemplo, no "notificar agora"), não uma peça de correção.

## 3. Reagendamento: "na entrega, checa e reagenda"

**Funciona.** Nada na doc impede que o handler publique uma nova mensagem atrasada antes de responder 2xx. **Não existe debounce nativo no QStash.** O Flow Control limita taxa e paralelismo por chave e põe o excedente numa fila de espera. Ele não descarta nem funde mensagens: "additional messages will be added to waitlist and delivered once...". ([Flow Control](https://upstash.com/docs/qstash/features/flowcontrol)) Logo, o Flow Control não resolve o nosso caso. No máximo, `Upstash-Flow-Control-Key = eventId` com paralelismo 1 serializa entregas do mesmo Event, o que é opcional.

Desenho que segue a doc (o estado fica no Postgres, o QStash é só despertador):

1. **A cada edição** de Event publicado: grava ou atualiza o "lote pendente" do Event (`firstPendingAt`, `lastEditAt`). Se não há despertador agendado, calcula `dueAt = min(lastEditAt + 10 min, firstPendingAt + 30 min)`, publica com `Upstash-Not-Before: dueAt` e `Upstash-Deduplication-Id: notify:<eventId>:<dueAt>`, e grava `scheduledFor = dueAt`. Se já há despertador, só atualiza `lastEditAt`, sem nova mensagem.
2. **Na entrega:** verifica a assinatura e relê o lote. Sem lote pendente (já enviado por "notificar agora", por exemplo): responde 200, sem fazer nada. Senão recalcula `dueAt`. Se `now < dueAt`, publica nova mensagem com `Not-Before = dueAt`, atualiza `scheduledFor` e responde 200. Se `now >= dueAt`, reivindica o lote de forma atômica (`UPDATE ... WHERE sentAt IS NULL`), envia e responde 200.
3. **"Notificar agora":** reivindica e envia na hora. O despertador pendente vira no-op na entrega. Se quiser, também cancela a mensagem (seção 2).

Volume por ciclo: 1 mensagem inicial mais no máximo cerca de 3 reagendamentos, porque o teto de 30 min corta a cadeia. A alternativa ingênua, publicar uma mensagem atrasada a cada edição e deixar a entrega descartar as velhas, também funciona, mas gasta uma mensagem por edição.

Cuidado com o ADR-0010: a publicação no QStash acontece depois do commit, dentro do `waitUntil`. Se ela falhar, o lote fica pendente sem despertador. O passo 1 deve tratar `scheduledFor` vencido ou nulo como "sem despertador" e republicar na próxima edição. Também vale ter uma reconciliação barata, que pode ser um cron diário (seção 5).

### Upstash Workflow resolve melhor?

O Workflow tem primitivas que modelam debounce: `context.waitForEvent(id, eventId, { timeout })` pausa sem consumir compute até um `notify` ou até o timeout (padrão de 7 dias; máximo de 7 dias no Free e 1 ano no pay as you go). Com `workflowRunId`, o `notify` tem "lookback" e resolve a corrida em que o notify chega antes do wait. ([Wait for Event](https://upstash.com/docs/workflow/features/wait-for-event), [context.waitForEvent](https://upstash.com/docs/workflow/steps/waitForEvent), [context.notify](https://upstash.com/docs/workflow/basics/context/notify)) Um run por lote faria um laço de `waitForEvent("edit:<eventId>", timeout = min(10 min, tempo até o teto))`: timeout envia, evento recomeça a espera, e "notificar agora" sai do laço.

O custo é cobrado em mensagens QStash: `run`, `sleep` e `waitForEvent` custam 1 cada, `context.call` custa 2 e cada retentativa custa 1. ([Workflow pricing](https://upstash.com/docs/workflow/pricing)) As desvantagens no nosso caso:

- traz mais um SDK e mais um modelo de execução (endpoint `serve`, replay de steps) para dentro da arquitetura NestJS;
- não elimina o estado no banco, porque o conteúdo da notificação e o "já enviado" continuam lá;
- iniciar exatamente um run por lote continua sendo problema nosso.

Para um timer de 10 a 30 min, o ganho não paga a complexidade.

## 4. Rota que recebe a mensagem: assinatura, retentativas e DLQ

### Verificação de assinatura

- O QStash envia um JWT no header `Upstash-Signature`, assinado com a sua chave. Existem duas chaves, **current** e **next**, para a rotação. ([Signature](https://upstash.com/docs/qstash/howto/signature))
- O `Receiver` do `@upstash/qstash` recebe `{ currentSigningKey, nextSigningKey }`, e `receiver.verify({ signature, body, url?, clockTolerance?, upstashRegion? })` tenta a current e depois a next. Se nenhuma passar, ele lança `SignatureError`. Ele também valida o hash do corpo e, se `url` for informada, o `sub` contra a URL. ([receiver.ts](https://github.com/upstash/qstash-js/blob/main/src/receiver.ts))
- **Use o corpo cru.** "converting parsed JSON back to a string may cause verification failures". ([Signature](https://upstash.com/docs/qstash/howto/signature)) No NestJS com Express: `NestFactory.create(AppModule, { rawBody: true })` e `@Req() req: RawBodyRequest<Request>`, que expõe `req.rawBody` como `Buffer`. ([NestJS raw body](https://docs.nestjs.com/faq/raw-body)) Hoje o `src/bootstrap.ts` não liga `rawBody`, então esse ajuste entraria junto com a rota.
- Na prática: um guard dedicado à rota do QStash, fora da autenticação por API token, com envs `QSTASH_CURRENT_SIGNING_KEY` e `QSTASH_NEXT_SIGNING_KEY`. O `url` deve ser a URL pública da rota, porque omiti-lo desliga a checagem de destino. Assinatura inválida responde 401.

### Retentativas e falha

- Por padrão são **3 retentativas** (configurável com `Upstash-Retries`), com backoff `min(86400, e^(2.5n))` s: cerca de 12 s, 2 min 28 s, 30 min 8 s... Qualquer resposta fora de 2xx dispara retentativa. A exceção é **489 com `Upstash-NonRetryable-Error: true`**, que pula as retentativas. O header `Retry-After` na resposta é respeitado, e o `Upstash-Retry-Delay` aceita uma expressão customizada. ([Retry](https://upstash.com/docs/qstash/features/retry))
- A tentativa é abortada se passar da "Max HTTP Response Duration" do plano (15 min no Free). ([Retry](https://upstash.com/docs/qstash/features/retry), [Pricing](https://upstash.com/pricing/qstash)) Na prática, quem limita antes é o `maxDuration` da Vercel Function.
- Esgotadas as retentativas, a mensagem fica `FAILED` e vai para a **DLQ**, onde fica 3 dias no Free e 7 no pay as you go. De lá dá para reenviar ou apagar pelo console ou pela API. ([DLQ](https://upstash.com/docs/qstash/features/dlq), [Debug logs](https://upstash.com/docs/qstash/howto/debug-logs), [Pricing](https://upstash.com/pricing/qstash)) Opcionalmente, o `Upstash-Failure-Callback` chama uma URL nossa quando a mensagem falha. ([Handling failures](https://upstash.com/docs/qstash/howto/handling-failures))
- Consequência para o desenho: um erro transitório no envio de email atrasa a notificação em 12 s, depois 2,5 min, depois 30 min. Como o handler é idempotente, a retentativa é segura. Um erro permanente (Event apagado, por exemplo) deve responder 2xx ou 489 não-retentável, para não gastar mensagens.

## 5. Alternativas na mesma infraestrutura

| Opção | Como ficaria | Quando seria melhor | Fonte |
| --- | --- | --- | --- |
| **Vercel Cron** | Uma varredura a cada minuto busca lotes com `dueAt <= now` e envia. | No **Hobby não serve**: só roda uma vez por dia e com ±59 min de imprecisão. No **Pro** roda a cada minuto, com precisão de minuto e sem custo extra além das Functions. Seria melhor se já estivermos no Pro (ADR-0007 prevê a migração se virar produto) e quisermos zero dependência nova. Ressalvas: entrega "best effort", **sem retentativa**, pode duplicar ou pular execuções, e gera 1.440 invocações/dia mesmo sem trabalho. | [Usage & pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing), [Managing cron jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs) |
| **Upstash Workflow** | Um run por lote com laço de `waitForEvent` (seção 3). | Se o fluxo crescer (vários passos, esperas longas, coordenação entre notificações). Para um despertador só, é exagero. | [Wait for Event](https://upstash.com/docs/workflow/features/wait-for-event), [Workflow pricing](https://upstash.com/docs/workflow/pricing) |
| **Vercel Queues** (fora do escopo, só registro) | Atraso de entrega até o fim da retenção e idempotency keys. | Está em **beta**. Só faria sentido se quiséssemos sair do Upstash. | [Vercel Queues](https://vercel.com/docs/queues) |

Uso o Vercel Cron diário (que cabe no Hobby) como **reconciliação**, não como mecanismo principal: ele pega lotes pendentes sem despertador ou com o despertador perdido na DLQ.

## Recomendação

Use **QStash com mensagem atrasada (`Upstash-Not-Before`) e checagem e reagendamento na entrega**, como proposto, com o estado do lote no Postgres como fonte da verdade:

- **Deduplicação:** `Deduplication-Id` por agendamento (`eventId:dueAt`), só contra publicação duplicada. Não conte com ele para garantir "uma mensagem por Event", porque a janela é de só 10 min.
- **Idempotência:** handler idempotente, com reivindicação atômica do lote. O cancelamento no "notificar agora" é opcional.
- **Assinatura:** guard com `Receiver` (chaves current/next) sobre o `rawBody`.
- **Falhas:** retentativas padrão, 489 para erro permanente, e a DLQ monitorada.
- **Cron diário** de reconciliação para lotes órfãos.

Reavaliar o Vercel Cron por minuto se a conta for para o Pro e quisermos tirar uma dependência. O Upstash Workflow só compensa se o fluxo de notificação ganhar mais passos.
