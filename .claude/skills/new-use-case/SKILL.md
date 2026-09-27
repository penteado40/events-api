---
name: new-use-case
description: Cria um use case na events-api seguindo o módulo de referência identity (NestJS, Clean Architecture, DDD pragmático), do domínio ao endpoint, com testes. Use ao adicionar um endpoint, um use case, uma regra de negócio ou um módulo novo (events, rsvp, registry, emails).
---

# Novo use case

O módulo `src/modules/identity` é o **gabarito**: antes de escrever cada arquivo, abra o equivalente dele e siga a mesma forma. Regras e armadilhas por camada: [REFERENCE.md](REFERENCE.md). Teoria: `docs/arquitetura.md`.

## Passos

1. **Vocabulário.** Leia `CONTEXT.md` e os ADRs da área. Nomeie entidades, use cases e rotas com os termos do glossário (`VerifyContributionUseCase`, nunca `ConfirmPayment`).
   _Pronto quando_ cada nome novo está no glossário ou foi anotado como lacuna para o usuário.

2. **Módulo.** Se o contexto ainda não existe em `src/modules/<nome>/`, crie o esqueleto (seção "Módulo novo" do REFERENCE).
   _Pronto quando_ `<nome>.module.ts` e `index.ts` existem e o módulo está importado em `src/app.module.ts` pelo `index.ts`.

3. **Seams.** Liste os seams a testar e confirme com o usuário, como pede o `/tdd`: normalmente o use case (unitário, ports falsos em memória) e o endpoint (integração HTTP).
   _Pronto quando_ o usuário aprovou a lista.

4. **Domínio → application, em red → green.** Um teste unitário por vez em `application/use-cases/<acao>.use-case.spec.ts`, depois o mínimo de código em `domain/` e `application/`. Entidade rica só se houver regra que pode ser quebrada (§6 da arquitetura).
   _Pronto quando_ cada comportamento do ticket tem um teste unitário verde e `npx vitest run --project unit <arquivo>` passa.

5. **Infrastructure.** Schema Prisma + migration, repositório `prisma-*` com mapper `toDomain`, adaptadores dos ports.
   _Pronto quando_ `npm run prisma:migrate -- --name <nome>` gerou a migration e `npm run typecheck` passa.

6. **Presentation e composição.** DTO Zod, presenter, controller e o registro no `*.module.ts` com `useFactory`.
   _Pronto quando_ o endpoint aparece em `/api/v1/openapi` com `DOCS_ENABLED=true`.

7. **Integração.** Teste HTTP em `test/integration/<recurso>.spec.ts` com `createTestApp` e as factories, cobrindo sucesso, cada código de erro novo e o acesso (401 sem token, 403 quando couber).
   _Pronto quando_ cada critério de aceite do ticket tem um teste de integração verde.

8. **Verificação.** `npm run typecheck`, `npm run lint`, `npm test`.
   _Pronto quando_ os três passam sem alterar regra de lint. Se o lint de arquitetura reclamar, mude o código de camada, nunca a regra.
