# NestJS como framework HTTP, com Zod como fonte única de validação e OpenAPI

O plano original era Hono, o mesmo da `fawedding-api`. Trocamos por **NestJS** antes da primeira linha de código, por valor de mercado: é o framework Node mais pedido em vagas de backend no Brasil, e o projeto serve também de portfólio. O PRD encaixa bem no modelo do Nest: a AccessPolicy vira guard, os adaptadores (RateLimitStore, MediaStorage, Resend) viram providers injetáveis e cada recurso vira um módulo. Consideramos Express puro (leve, mas sem estrutura nem OpenAPI nativo) e manter Hono (mais leve em serverless, mas nicho).

Para não perder a regra do PRD de que validação e documentação saem do mesmo schema, usamos `nestjs-zod` (`createZodDto` + `ZodValidationPipe`) com `@nestjs/swagger`, e não `class-validator`, em que cada campo repete decorators de validação e de `@ApiProperty` que acabam divergindo. A documentação usa Scalar (`@scalar/nestjs-api-reference`) sobre o documento do Swagger.

## Consequences

- Autenticação por `@nestjs/passport` + `passport-jwt` com guard **global** e decorator `@Public()` para as exceções: esquecer o decorator fecha a rota em vez de abri-la. API tokens (Scopes) entram como uma segunda estratégia do Passport.
- Erros saem de um catálogo único de códigos: o domínio lança `AppError` só com o código, e um exception filter global traduz código → status HTTP e monta o formato do ADR-0008, inclusive os 401 do Passport e os erros de validação do Zod. Não usamos `HttpException` com mensagem solta.
- O código segue Clean Architecture com DDD pragmático (ver `docs/arquitetura.md`): um módulo por bounded context em `src/modules/` (`identity`, `events`, `rsvp`, `registry`, `emails`) mais `src/shared/`, cada um com as camadas `domain`, `application`, `infrastructure` e `presentation`. `domain` e `application` não importam Nest, Prisma nem Zod; o `*.module.ts` registra as classes deles com `useFactory`/`useClass`, e os ports são `abstract class` usadas como token de injeção.
- A regra da dependência e as fronteiras entre módulos (cada módulo só é importado pelo seu `index.ts`) são fiscalizadas por ESLint (`eslint-plugin-boundaries` + `no-restricted-imports`), no editor e no CI.
- Testes de integração usam `@nestjs/testing` + supertest contra um Postgres real.
- O cold start na Vercel é maior que o do Hono (bootstrap da injeção de dependências). É aceitável para o tráfego dos Sites; se incomodar, o plano B é cachear a instância do app entre invocações e, em último caso, um servidor sempre ligado.
