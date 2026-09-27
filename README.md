# events-api

API multi-evento (casamentos, aniversários, eventos corporativos...) que sustenta os sites de eventos: RSVP, lista de presentes com contribuições via Pix e emails para convidados. Sucessora da [`fawedding-api`](https://github.com/penteado40/fawedding-api).

> Em planejamento: nenhum código ainda. Comece por aqui:

- [`CONTEXT.md`](CONTEXT.md): glossário do domínio
- [`docs/adr/`](docs/adr): decisões de arquitetura
- [`docs/arquitetura.md`](docs/arquitetura.md): Clean Architecture, DDD e SOLID, e como se aplicam aqui
- Tarefas: no Jira, épico [PROJ-51](https://flpenteado.atlassian.net/browse/PROJ-51); o PRD da V1 é a [issue #1](https://github.com/penteado40/events-api/issues/1)

Stack planejada: TypeScript, NestJS, Zod (`nestjs-zod`) + OpenAPI/Scalar, Prisma + Postgres (Neon), Vercel Functions, Upstash Redis, Resend + React Email, Cloudinary.
