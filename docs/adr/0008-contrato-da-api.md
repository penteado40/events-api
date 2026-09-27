# Contrato da API: /api/v1, erros com código estável e datas ISO 8601

Como os Sites precisam ser alterados de qualquer forma na migração, aproveitamos para fixar um contrato novo. As rotas ficam sob `/api/v1`, para permitir uma V2 sem quebrar os Sites. Respostas de sucesso mantêm `{ data }`, e erros passam de `{ errors: "mensagem" }` para `{ error: { code, message, details? } }`, com `code` estável (ex.: `EVENT_ARCHIVED`), para que o Site escolha o texto mostrado ao Guest sem depender da mensagem. Datas saem em ISO 8601 UTC acompanhadas do `timezone` do evento, e entram em ISO 8601 com offset; o formato `dd/mm/aaaa` da API antiga deixa de ser aceito, porque agora o início do evento tem hora e fuso.

## Consequences

- `POST /api/v1/auth/token` existe só para o login do Scalar e segue o formato OAuth2 password (RFC 6749): entra `application/x-www-form-urlencoded` e sai `{ access_token, token_type, expires_in }` ou `{ error: "invalid_grant" }`, e não o envelope `{ data }`/`{ error: { code } }`. Não é um descuido a corrigir.
- A documentação (`/api/v1/docs`, `/api/v1/openapi`) e o `/auth/token` só são registrados com `DOCS_ENABLED=true`, desligado em produção. Em produção o único login é `POST /api/v1/auth/login`.
