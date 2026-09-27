# events-api

API multi-evento (casamentos, aniversários, eventos corporativos...) que sustenta os sites de eventos: RSVP, lista de presentes com contribuições via Pix e emails para convidados. Sucessora da [`fawedding-api`](https://github.com/penteado40/fawedding-api).

- [`CONTEXT.md`](CONTEXT.md): glossário do domínio
- [`docs/adr/`](docs/adr): decisões de arquitetura
- [`docs/arquitetura.md`](docs/arquitetura.md): Clean Architecture, DDD e SOLID, e como se aplicam aqui. O módulo `src/modules/identity` é a referência.
- Tarefas: no Jira, épico [PROJ-51](https://flpenteado.atlassian.net/browse/PROJ-51); o PRD da V1 é a [issue #1](https://github.com/penteado40/events-api/issues/1)

Stack: Node 22, TypeScript (ESM, `strict`), NestJS 11, Zod (`nestjs-zod`) + OpenAPI/Scalar, Prisma 7 + Postgres (Neon em produção), Vercel Functions. Por vir: Upstash Redis, Resend + React Email, Cloudinary.

## Rodando localmente

Pré-requisito: o stack compartilhado [`docker-local`](../docker-local) (Postgres 16 em `localhost:5432`) rodando, com a role `events_api` (`CREATEDB`, para a shadow database do `migrate dev`) e os bancos `events_api_db` e `events_api_test`. O `initdb/init.sql` de lá cria os três; se o volume já existia antes desse bloco, rode o bloco do `events-api` à mão como `admin`.

```bash
nvm use                      # Node 22
cp .env.example .env
npm install                  # roda o prisma generate
npx prisma migrate deploy
npx prisma db seed           # Super admin local: admin@local.test / admin123
npm run dev                  # http://localhost:3000/api/v1
```

Com `DOCS_ENABLED=true`, a documentação fica em `/api/v1/docs` (Scalar, com login pelo botão de autenticação) e o OpenAPI em `/api/v1/openapi`.

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Compila em watch e reinicia o servidor |
| `npm run typecheck` | `tsc --noEmit` (inclui testes, scripts e a entrada da Vercel) |
| `npm run lint` | ESLint (inclui as regras de arquitetura) + Prettier |
| `npm run test:unit` | Testes unitários (`src/**/*.spec.ts`) e das regras de arquitetura do ESLint, sem banco |
| `npm run test:integration` | Testes HTTP contra o Postgres em `DATABASE_URL_TEST` |
| `npm run prisma:migrate` | `prisma migrate dev`: cria uma migration a partir do `schema.prisma` |
| `npm run create-super-admin -- --email=... --name=... --password=... [--reset-password]` | Cria ou promove o Super admin (idempotente; em produção exige senha de 12+ caracteres) |

## Deploy

`api/index.ts` é a entrada das Vercel Functions (runtime Node.js) sobre o mesmo `AppModule` do `src/main.ts`. O deploy real é validado na PROJ-53.
