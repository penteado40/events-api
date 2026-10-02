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

## Emenda (PROJ-97): a documentação é contrato testado

O Scalar é a interface visual de teste manual da API, então uma rota sem resumo, sem os erros possíveis ou com o body preenchido com `"string"` é uma rota mal documentada, mesmo aparecendo na doc. Como a doc é gerada do código, não há arquivo para "lembrar de atualizar": o que se esquece é a qualidade. Por isso ela é fiscalizada por teste, e não por disciplina, como a regra da dependência é fiscalizada pelo lint.

- `test/integration/docs.spec.ts` falha se uma rota registrada no Express não aparece no OpenAPI (fora uma allowlist explícita), se uma operação não tem resumo ou não declara `@ApiErrors` (vazio quando não há erro de negócio, porque o 401 implícito faria qualquer rota privada parecer documentada), ou se um campo de request body, inclusive aninhado, não tem exemplo.
- Os erros de cada rota saem do `ERROR_CATALOG` (ADR-0008) pelo decorator `@ApiErrors(...códigos)`, e não por `@ApiResponse` escrito à mão, que repetiria status e mensagem e divergiria do catálogo. O envelope `{ error: { code, message, details? } }` vem do mesmo schema Zod que o exception filter usa. 401 em toda rota sem `@Public()` e 400 `VALIDATION_ERROR` em toda rota com body ou parâmetros entram sozinhos; o método declara só os erros de negócio.
- `@Public()` também tira a rota da segurança global da doc, para que o cadeado do Scalar e o guard nunca divirjam.
- **Os textos da doc são em português** (resumos, descrições de operação e de campo), embora o código e os comentários sejam em inglês. O Scalar é interface de produto e já mostra as mensagens de erro do catálogo em português; os termos do glossário ficam em inglês, como no `CONTEXT.md`. Não "corrija" esses textos para inglês.
- Os exemplos dos request bodies funcionam contra o seed local (login do Super admin `admin@local.test`). Executar um exemplo não pode quebrar outro (a troca de senha "troca" a senha do seed por ela mesma). Valor que só existe em tempo de execução, como o token de ativação, usa um placeholder descritivo. Nunca use como exemplo uma credencial que exista fora do ambiente local: o OpenAPI dos previews é público.

## Emenda: pivô para Groups (2026-10-02)

NestJS, `nestjs-zod`, Scalar e a fiscalização por lint continuam valendo. A lista de módulos acima (`events`, `rsvp`, `registry`, `emails`) é da V1: os contextos do pivô ainda estão em definição (ver `docs/arquitetura.md` e o mapa PROJ-51). A segunda estratégia do Passport para API tokens sai com os Sites (ADR-0016), e o Guest access link (ADR-0018) é a candidata natural a ocupar esse lugar. O cold start passa a ser medido contra o tráfego do app mobile, não dos Sites.
