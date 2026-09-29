# Referência por camada

Cada seção aponta o arquivo do `identity` que serve de gabarito. O código é a fonte da verdade; aqui ficam só as regras que ele não conta sozinho.

## Em todas as camadas

- ESM: import relativo termina em `.js`, mesmo apontando para `.ts` (`'./user.entity.js'`). Sem alias `@/`.
- Import de outro módulo só pelo `index.ts` dele (`../../identity/index.js`). `domain/` não importa outro módulo.
- Uma classe injetada pelo construtor (use case, port, `PrismaService`, `AppConfig`) entra como **import de valor**, nunca `import type`: o Nest lê o tipo pelo metadata do decorator.
- O ESLint classifica pelo caminho (`src/modules/*/<camada>`): pasta nova no lugar certo já nasce fiscalizada, sem mexer no `eslint.config.js`.

## domain/ — `identity/domain/user.entity.ts`, `user.repository.ts`, `password-policy.ts`

- TypeScript puro: sem Nest, Prisma, Zod, bcrypt. Sem `@Injectable()`.
- Entidade com construtor privado, `restore(props)` para reidratar, getters e métodos com nome do negócio (`promoteToSuperAdmin()`, `markPaid()`), nunca setters.
- Regra quebrada lança `new AppError('<CODIGO>')` (`shared/domain/app-error.ts`).
- Repositório é `abstract class` (token de injeção). Id é `Int` gerado pelo banco (ADR-0002): criar é `create(props): Promise<Entidade>`, alterar é `save(entidade)`.

## application/ — `identity/application/use-cases/login.use-case.ts`

- Um use case por ação, classe `<Acao>UseCase` com `execute(input)`; tipos `<Acao>Input` e `<Acao>Output` no mesmo arquivo. Use case não chama outro use case.
- Serviço técnico vira port em `application/ports/` (`abstract class`, ver `password-hasher.ts`).
- Dublês para os testes em `application/testing/`: `in-memory-<x>.repository.ts` para repositórios, `fake-<x>.ts` para ports técnicos. Teste pelo `execute()`, com valores esperados literais.

## Erros — `shared/domain/app-error.ts` + `shared/presentation/error-catalog.ts`

Código novo exige as duas edições: o literal na união `ErrorCode` e a entrada `{ status, message }` (mensagem em português) no `ERROR_CATALOG`. O typecheck acusa se faltar a segunda. Formato da resposta: ADR-0008.

## infrastructure/ — `identity/infrastructure/prisma-user.repository.ts`

- Tipos do Prisma só aqui, importados de `../../../generated/prisma/client.js`, e convertidos no `toDomain(row)` do próprio repositório.
- Model novo em `prisma/schema.prisma` com `@@map("<tabela_no_plural>")`; gere a migration com `npm run prisma:migrate -- --name <nome>` e commite `prisma/migrations/`. Índice que o Prisma não gera (ex.: único parcial, ADR-0003) vai como SQL na migration.
- Todo model nasce com autoria: `createdAt`, `updatedAt`, `createdById` e `updatedById` (§5.8 da arquitetura). A entidade marca autor e hora a cada mudança; o use case passa quem está agindo. Casos sem User logado: siga a PROJ-96 até a forma final entrar no §5.8.
- Adaptador prefixado pela tecnologia (`prisma-`, `resend-`, `cloudinary-`, `upstash-`), com `@Injectable()` e `extends <Port>`.

## presentation/ — `identity/presentation/auth.controller.ts`, `me.controller.ts`, `dto/`, `user.presenter.ts`

- Zod só em `dto/*.dto.ts`: entrada com `createZodDto` (o `ZodValidationPipe` global valida) e resposta também como DTO, para o OpenAPI (`@ApiOkResponse({ type })`).
- Controller só traduz HTTP ↔ use case: sem regra de negócio. Sucesso sai como `{ data }`.
- Toda rota exige JWT pelo guard global; `@Public()` só para acesso anônimo de fato. `@CurrentUser()` entrega o `User`.
- Presenter converte entidade → JSON (datas com `toISOString()`, nada sensível).

## Composição — `identity/identity.module.ts` e `index.ts`

- Port → adaptador: `{ provide: UserRepository, useClass: PrismaUserRepository }`.
- Use case (sem `@Injectable`): `{ provide: XUseCase, useFactory: (a, b) => new XUseCase(a, b), inject: [A, B] }`.
- `index.ts` exporta o módulo Nest e o que outros contextos podem consumir (tipos, serviços de consulta, domain events).
- Consulta oferecida a outro contexto mora num módulo estático `<nome>-queries.module.ts`, sem controllers, que exporta só a classe de consulta (`identity/identity-queries.module.ts` → `UserLookup`). Quem consome importa esse módulo no próprio `imports` e depende dele por um port seu em `application/ports/`. Nunca torne um módulo `global` para compartilhar consultas: a dependência entre contextos precisa aparecer no `*.module.ts`.
- O repositório que o módulo principal e o de consultas usam é ligado uma vez só, num `<nome>-persistence.module.ts` interno (fora do `index.ts`), importado pelos dois (`identity/identity-persistence.module.ts`). O módulo de consultas **não** reexporta o repositório: quem o importa enxerga só as consultas, nunca um jeito de escrever no contexto alheio.

## Módulo novo

```
src/modules/<nome>/
  domain/  application/ports/  application/use-cases/  application/testing/
  infrastructure/  presentation/dto/
  <nome>.module.ts
  index.ts
```

Registre em `src/app.module.ts` importando de `./modules/<nome>/index.js`. Consultas a outro contexto (ex.: AccessPolicy do `events`) são chamadas diretas ao que ele exporta; fatos que outro contexto reage são domain events (§5.5 e §5.6 da arquitetura, ADR-0010). O primeiro domain event do projeto cria também a base descrita no §5.6 (`shared/domain/domain-event.ts`, o port `EventPublisher` e o `InProcessEventPublisher`).

## Testes de integração — `test/integration/me.spec.ts`

- `createTestApp({ env, controllers, override })` sobe o app real contra o `events_api_test`; feche com `t.close()` no `afterAll`.
- As tabelas são truncadas antes de cada arquivo (`test/integration/setup.ts`): arrume o estado com as factories de `support/factories.ts` e adicione uma factory por entidade nova.
- Resolva tokens antes de montar a requisição: `const token = await loginAs(...)`, depois `t.http().get(...).auth(token, { type: 'bearer' })`. Duas requisições supertest montadas ao mesmo tempo disputam o servidor efêmero.
