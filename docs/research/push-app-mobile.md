# Pesquisa: push para o app mobile (Expo Push vs FCM/APNs)

Ticket: PROJ-117 (épico PROJ-51). Pesquisa feita em 2026-10-02 contra as docs oficiais do Expo, do Firebase, da Apple e o código do `expo-server-sdk-node`. Documento descartável: serve para decidir, não é ADR.

Contexto: a events-api roda em Vercel Functions, sem processo sempre ligado (ADR-0007). O app `events-expo` é Expo/React Native. Quando a produção edita um Event publicado, cada integrante recebe email e push com o que mudou para ele. Um User pode ter vários aparelhos.

## 1. Expo Push Service vs FCM/APNs direto

### Custo e limites

| | Expo Push Service | FCM HTTP v1 | APNs |
|---|---|---|---|
| Custo | Gratuito ([FAQ](https://docs.expo.dev/push-notifications/faq/)) | "No-cost" nos planos Spark e Blaze ([pricing](https://firebase.google.com/pricing)) | Incluído na conta Apple Developer paga, exigida para push no iOS ([setup Expo](https://docs.expo.dev/push-notifications/push-notifications-setup/)) |
| Taxa | 600 notificações/s por projeto; acima disso, `TOO_MANY_REQUESTS` ([sending](https://docs.expo.dev/push-notifications/sending-notifications/)) | 600 mil mensagens/min por projeto (token bucket de 1 min) ([scale-fcm](https://firebase.google.com/docs/cloud-messaging/scale-fcm)) | Sem número publicado. Responde `429 TooManyRequests` para muitos envios seguidos ao mesmo token ([respostas APNs](https://developer.apple.com/documentation/usernotifications/handling-notification-responses-from-apns)) |
| Lote por requisição | Até 100 mensagens por `POST /push/send` (`PUSH_TOO_MANY_NOTIFICATIONS`) | Uma mensagem por requisição no HTTP v1 | Uma notificação por requisição (stream HTTP/2) |
| Tamanho do payload | 4096 bytes no total (`MessageTooBig`) | `INVALID_ARGUMENT` se passar do limite ([error codes](https://firebase.google.com/docs/cloud-messaging/error-codes)) | `413 PayloadTooLarge` |

Para o volume da events-api (um grupo artístico, dezenas de integrantes, alguns aparelhos cada), nenhum desses limites pesa.

### O que muda no app

- **Com Expo Push**: o app usa `expo-notifications` + `expo-constants` e chama `getExpoPushTokenAsync({ projectId })`. O token tem a forma `ExponentPushToken[...]` ([setup](https://docs.expo.dev/push-notifications/push-notifications-setup/)).
- **Com FCM/APNs direto**: o app chama `getDevicePushTokenAsync()` e recebe o token nativo (FCM no Android, APNs no iOS). O servidor passa a falar com dois provedores ([sending-notifications-custom](https://docs.expo.dev/push-notifications/sending-notifications-custom/)).
- **Development build, não Expo Go**: a partir do SDK 53 o push não funciona no Expo Go para Android; é preciso um development build. Também precisa de aparelho físico, emulador Android com Google Play services ou simulador iOS no Xcode 14+ ([setup](https://docs.expo.dev/push-notifications/push-notifications-setup/), [FAQ](https://docs.expo.dev/push-notifications/faq/)).
- **Credenciais** (precisa delas nos dois caminhos; o que muda é quem guarda):
  - Android: chave de service account do FCM v1, enviada ao EAS ([setup](https://docs.expo.dev/push-notifications/push-notifications-setup/)).
  - iOS: chave APNs (`.p8`), gerada pelo EAS no primeiro build ou enviada a ele.
  - Com Expo Push, essas chaves ficam no EAS e a API não guarda nenhum segredo de FCM/APNs. No máximo guarda um access token do Expo, se ligar a "enhanced security" no painel do EAS (header `Authorization: Bearer`; sem ele a requisição volta `UNAUTHORIZED`) ([sending](https://docs.expo.dev/push-notifications/sending-notifications/)).
  - Com FCM/APNs direto, a API guarda a service account do Firebase e troca por um token OAuth 2.0. Também guarda a `.p8`, o Key ID e o Team ID, e assina um JWT ES256 ([sending-notifications-custom](https://docs.expo.dev/push-notifications/sending-notifications-custom/)).

### O custo extra de ir direto ao APNs em serverless

- O APNs só aceita HTTP/2 + TLS 1.2 ([sending requests](https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns)).
- O JWT do provider precisa ser renovado entre 20 e 60 minutos. Trocar o token mais de uma vez a cada 20 minutos na mesma conexão dá `429 TooManyProviderTokenUpdates`. Com `iat` mais velho que 1 hora, o APNs devolve `403 ExpiredProviderToken` ([token-based connection](https://developer.apple.com/documentation/usernotifications/establishing-a-token-based-connection-to-apns)).
- A Apple orienta montar uma "recurring task" para regenerar o token e manter conexões reaproveitadas. Isso foi pensado para um servidor sempre ligado. Numa Vercel Function cada cold start abre uma conexão nova e gera um JWT novo. É viável, mas tudo isso fica por nossa conta.
- No Android, o payload direto ao FCM ainda precisa dos campos que o `expo-notifications` espera, como `channelId` dentro de `data` ([sending-notifications-custom](https://docs.expo.dev/push-notifications/sending-notifications-custom/)).

## 2. Tokens por aparelho, tokens inválidos e limpeza

### Registro

- Um User tem N tokens, um por aparelho/instalação. O app manda o token à API no login e quando ele muda. A API faz upsert pela chave `token` e grava `userId`, plataforma e `lastSeenAt`.
- Ciclo de vida do token Expo ([FAQ](https://docs.expo.dev/push-notifications/faq/)):
  - Continua o mesmo entre atualizações do app.
  - No Android pode mudar ao reinstalar; no iOS persiste mesmo após desinstalar.
  - Não expira, mas fica inválido quando o app é desinstalado.
  - Só muda por outros motivos se mudar o `applicationId`/`experienceId`.
- O FCM recomenda guardar o token com um timestamp, atualizado a cada vez que o app sobe o token ([manage-tokens](https://firebase.google.com/docs/cloud-messaging/manage-tokens)):
  - "Any registration older than one month is likely to be an inactive device".
  - No Android, um token inativo por 270 dias expira e passa a ser rejeitado.
- No logout, o app deve pedir à API para apagar o token daquele aparelho, para outro User não receber push no mesmo aparelho. Essa parte é recomendação nossa, não está nas docs.

### Erros que significam "apague este token"

| Provedor | Erro | Fonte |
|---|---|---|
| Expo | `DeviceNotRegistered`, no ticket ou no receipt: "stop sending notifications to this device's push token until it re-registers". Aparece só quando Google/Apple consideram o aparelho desregistrado, sem prazo definido | [sending](https://docs.expo.dev/push-notifications/sending-notifications/) |
| FCM v1 | `UNREGISTERED` (404); `INVALID_ARGUMENT` (400) quando o payload está certo: "it is safe to delete your record of this registration" | [manage-tokens](https://firebase.google.com/docs/cloud-messaging/manage-tokens), [error codes](https://firebase.google.com/docs/cloud-messaging/error-codes) |
| APNs | `410 Unregistered` / `410 ExpiredToken`. O corpo traz `timestamp`, o momento em que o APNs confirmou que o token deixou de valer. `400 BadDeviceToken` indica token inválido ou de outro ambiente (sandbox vs produção). A Apple pede para não retentar `BadDeviceToken`, `DeviceTokenNotForTopic`, `ExpiredToken`, `Unregistered` e `PayloadTooLarge` | [respostas APNs](https://developer.apple.com/documentation/usernotifications/handling-notification-responses-from-apns) |

Erros que **não** são do token e não devem apagá-lo:

- Expo: `MessageTooBig`, `MessageRateExceeded` (backoff exponencial), `MismatchSenderId` e `InvalidCredentials` (credencial FCM/APNs errada ou revogada no EAS; erro de configuração, deve gerar alerta).
- FCM: `SENDER_ID_MISMATCH` e `THIRD_PARTY_AUTH_ERROR`.

A Apple avisa que muitos erros 4XX fazem o APNs derrubar a conexão do provider. O README do SDK do Expo diz que Apple/Google "may block apps that continue to send notifications to devices that have blocked notifications or have uninstalled your app" ([expo-server-sdk-node](https://github.com/expo/expo-server-sdk-node)). Por isso a limpeza é obrigatória, não um extra.

### Limpeza

1. **Reativa**: ao receber `DeviceNotRegistered` (ou o equivalente do FCM/APNs), apagar o token, seja no ticket na hora do envio, seja no receipt depois.
2. **Por idade**: apagar tokens com `lastSeenAt` acima de uma janela, por exemplo 1 a 2 meses, seguindo a orientação do FCM. Pode rodar num cron diário (cabe no plano Hobby da Vercel, ver abaixo).

## 3. Tickets e receipts do Expo

- **Ticket**: volta na hora, um por mensagem e na mesma ordem. `status: "ok"` com `id` (o id do receipt) só quer dizer que o Expo aceitou a mensagem, não que ela chegou. Um ticket com `status: "error"` não tem `id` e já traz `details.error`, por exemplo `DeviceNotRegistered` ([sending](https://docs.expo.dev/push-notifications/sending-notifications/)).
- **Receipt**: diz se a FCM/o APNs aceitou a mensagem. Não confirma entrega no aparelho.
  - O Expo recomenda consultar os receipts **15 minutos** depois do envio.
  - O README do SDK diz para dar até **30 minutos** quando o serviço está sob carga.
  - Os receipts são apagados depois de **24 horas** ("at least a day" no SDK).
  - Fontes: [sending](https://docs.expo.dev/push-notifications/sending-notifications/), [README](https://github.com/expo/expo-server-sdk-node).
- **Lotes**:
  - Envio: até **100** mensagens por requisição. `to` também aceita um array de tokens; o SDK conta cada destinatário e divide em chunks de 100 (`pushNotificationChunkLimit = 100`).
  - Receipts: até **1000** ids por requisição na API (`PUSH_TOO_MANY_RECEIPTS`). O SDK usa chunks de 300 (`pushNotificationReceiptChunkLimit = 300`) ([ExpoClientValues.ts](https://github.com/expo/expo-server-sdk-node/blob/main/src/ExpoClientValues.ts)).
  - Todas as mensagens de uma requisição precisam ser do mesmo projeto Expo (`PUSH_TOO_MANY_EXPERIENCE_IDS`).
- **Retentativa**:
  - Para 429 e 5xx, o Expo indica backoff exponencial. O SDK já faz isso sozinho para 429: 2 retentativas, fator 2, mínimo de 1 s ([ExpoClient.ts](https://github.com/expo/expo-server-sdk-node/blob/main/src/ExpoClient.ts)).
  - `MessageRateExceeded` no receipt pede backoff e reenvio daquela mensagem.
  - Erros permanentes (payload inválido, credencial ausente) não se resolvem com retentativa.
  - O Expo promete entrega "at-least-once" à FCM/ao APNs, então pode haver duplicata em casos raros ([FAQ](https://docs.expo.dev/push-notifications/faq/)).
- O Expo não guarda as notificações em banco; elas ficam só em memória e fila durante a entrega ([FAQ](https://docs.expo.dev/push-notifications/faq/)).

## 4. Compatibilidade com Vercel Functions

### SDK

- `expo-server-sdk` (repo `expo-server-sdk-node`), versão 7.2.0 no `main`:
  - É ESM (`"type": "module"`), exige Node `>=22.12.0` e usa `undici` para o `fetch`.
  - A events-api já é ESM com Node `>=22.12 <23`, então é compatível.
  - É puro HTTP/1.1 sobre HTTPS, comprime com gzip corpos acima de 1 KB e não mantém conexão nem estado.
- O HTTP direto também é simples:
  - `POST https://exp.host/--/api/v2/push/send` com array de mensagens.
  - `POST https://exp.host/--/api/v2/push/getReceipts` com `{ ids: [...] }`.
  - Fontes: [ExpoClientValues.ts](https://github.com/expo/expo-server-sdk-node/blob/main/src/ExpoClientValues.ts), [sending](https://docs.expo.dev/push-notifications/sending-notifications/).
- O SDK só agrega o chunking, a validação de token (`Expo.isExpoPushToken`), o retry em 429 e o limite de concorrência (6 requisições).

### Envio dentro da Function

- O envio cabe na própria requisição que edita o Event: são poucas chamadas HTTP de até 100 mensagens cada.
- Se ele rodar depois da resposta, precisa de `waitUntil`, como o email do RSVP (ADR-0007).

### Consultar os receipts sem worker

Não há processo vivo 15 minutos depois. Duas opções:

1. **QStash com atraso**: ao enviar, guardar os ids dos tickets (no banco ou no corpo da mensagem) e publicar uma mensagem no QStash com `Upstash-Delay: 15m`, apontando para um endpoint interno que busca os receipts e apaga os tokens com `DeviceNotRegistered`.
   - O atraso máximo é de 7 dias no plano free, folgado para 15 minutos ([QStash delay](https://upstash.com/docs/qstash/features/delay)).
   - O QStash já é da Upstash, que o projeto usa para rate limit.
   - Se a chamada ao endpoint falhar, o QStash retenta a entrega.
   - O endpoint precisa verificar a assinatura do QStash.
2. **Vercel Cron**: um job que lê do banco os tickets pendentes com mais de 15 minutos.
   - No plano Hobby o cron roda **no máximo 1 vez por dia**, com precisão de ±59 min. Expressões mais frequentes falham no deploy ([Vercel cron](https://vercel.com/docs/cron-jobs/usage-and-pricing)).
   - Como os receipts somem em 24 h, um cron diário pode perder receipts. Só no Pro (a cada minuto) o cron serve para isso.
   - O cron diário serve bem para a limpeza por idade (`lastSeenAt`).

Perder um receipt não é grave: o token inválido volta como `DeviceNotRegistered` no ticket ou no receipt do próximo envio. A limpeza por idade cobre o resto.

## Recomendação

Usar o **Expo Push Service** com o `expo-server-sdk`:

- É gratuito e os limites (600/s, 100 por requisição) sobram para o volume de um grupo artístico.
- A API não guarda chaves de FCM/APNs, só o access token opcional do Expo.
- Evita na Vercel o HTTP/2 do APNs e a renovação do JWT a cada 20 a 60 minutos.

Como fazer:

- No app: `expo-notifications` num development build. Credenciais FCM v1 e APNs no EAS.
- Na API: guardar um token por aparelho (`userId`, `token`, `platform`, `lastSeenAt`), com upsert no login e no app abrindo, e delete no logout.
- Enviar em chunks dentro da requisição (ou em `waitUntil`) e apagar na hora os tokens com `DeviceNotRegistered` no ticket.
- Agendar a leitura dos receipts com **QStash `Upstash-Delay: 15m`** para um endpoint interno assinado.
- Rodar um **cron diário** para apagar tokens velhos.

FCM/APNs direto só compensa se um dia sairmos do Expo ou precisarmos de recurso nativo que o Expo Push não expõe. Essa troca pede mudar o app para `getDevicePushTokenAsync`.
