# Arquitetura: Clean Architecture, DDD e SOLID na events-api

Este documento explica **o que** são os padrões que usamos, **por que** eles existem e **como** se aplicam aqui, sempre com exemplos da própria events-api. Serve de guia para quem está aprendendo os padrões e de referência para quem (pessoa ou agente) vai escrever código no projeto.

Decisões relacionadas: ADR-0009 (NestJS) e ADR-0016 (pivô para programação de Groups). Vocabulário do domínio: [`CONTEXT.md`](../CONTEXT.md).

---

## 1. O problema que esses padrões resolvem

Numa API "comum", a regra de negócio acaba espalhada: um pedaço no controller, outro no service, outro numa query do Prisma. Na `fawedding-api` isso aconteceu com a checagem de acesso: só a rota de **criar** API token verificava se o usuário gerenciava o evento; listar, editar e apagar ficaram abertas porque cada rota decidia sozinha.

Os três padrões atacam isso por ângulos diferentes:

| Padrão | Pergunta que responde |
|---|---|
| **DDD** (Domain-Driven Design) | *O que* o sistema faz e *como falamos* disso? Quais são os conceitos, regras e fronteiras do negócio? |
| **Clean Architecture** | *Onde* cada tipo de código mora e *quem pode depender de quem*? |
| **SOLID** | *Como* escrever cada classe para que ela seja fácil de mudar e testar? |

---

## 2. DDD: Domain-Driven Design

A ideia central: **o código deve refletir o negócio**, com as mesmas palavras e as mesmas regras que as pessoas usam ao falar dele. DDD tem duas metades.

### 2.1 DDD estratégico (o mapa)

**Linguagem ubíqua (ubiquitous language).** Um vocabulário único, usado na conversa, nas issues, nos testes e no código. O nosso é o [`CONTEXT.md`](../CONTEXT.md). Se o glossário diz **Event item**, a classe é `EventItem`, e não `Activity` nem `Appearance`. Se diz **Team**, é `Team`, e não `Section` nem naipe. Quando uma palavra nova aparece no código e não está no glossário, ou estamos inventando linguagem ou o glossário tem uma lacuna.

**Bounded context (contexto delimitado).** Uma fronteira dentro da qual cada termo tem um significado só. Na events-api, cada contexto vira um módulo:

| Módulo | Responsável por |
|---|---|
| `identity` | Users, login, senha |
| `shared` | Não é contexto: a base comum (erros, value objects genéricos, Prisma, config) |

Os contextos do pivô (Groups e papéis, Events e Event items, notificações, e-mails) estão em definição: ver o mapa [PROJ-51](https://flpenteado.atlassian.net/browse/PROJ-51). O módulo `events` que existe hoje é da V1 e ainda não tem destino decidido.

Regra prática: **cada regra de negócio tem um dono**. "O último Owner não sai do Group" é do contexto dos Groups. "Só dá para cancelar um Event item publicado" é do contexto dos Event items. Nada disso vai para o `shared`.

### 2.2 DDD tático (as peças)

**Entity (entidade).** Um objeto com **identidade** que atravessa o tempo: dois Event items "Almoço" no mesmo horário continuam sendo Event items diferentes, porque têm ids diferentes. Uma entidade rica **protege as próprias regras**:

```ts
// <contexto>/domain/event-item.entity.ts (exemplo)
export class EventItem {
  private constructor(private props: EventItemProps) {}

  cancel(stamp: Stamp): void {
    if (this.props.state !== 'PUBLISHED') {
      throw new AppError('EVENT_ITEM_NOT_PUBLISHED')  // um Draft que não vai acontecer é apagado
    }
    this.props.state = 'CANCELLED'
    this.props.updatedAt = stamp.at
    this.props.updatedById = stamp.by
  }
}
```

Não existe `item.state = 'CANCELLED'` solto pelo código: a única forma de chegar em `CANCELLED` é passando pela regra.

**Value object (objeto de valor).** Um objeto **sem identidade**, definido só pelo valor, e **imutável**. Dois `Email('maria@local.test')` são iguais. Serve para dar nome e validação a algo que seria só um primitivo:

```ts
// shared/domain/email.vo.ts (exemplo)
export class Email {
  private constructor(readonly value: string) {}
  static create(raw: string): Email {
    const value = raw.trim().toLowerCase()
    if (!EMAIL_REGEX.test(value)) throw new AppError('VALIDATION_ERROR')
    return new Email(value)
  }
}
```

A regra "email é sempre minúsculo" (decidida para o login) passa a morar num lugar só, em vez de um `toLowerCase()` em cada service.

**Aggregate (agregado).** Um grupo de objetos tratado como uma unidade de consistência, com uma **raiz** que é a única porta de entrada. Exemplo: se uma regra de membros (o último Owner não sai do Group) precisa olhar todos os Group members de uma vez, os membros formam um agregado, e toda mudança passa pela raiz, que valida o conjunto. Regras de ouro:
- Outros agregados são referenciados **pelo id**, não pelo objeto (o Event item guarda `eventId`, não o `Event`).
- Uma transação altera **um** agregado.

**Repository (repositório).** A "coleção" de agregados, vista pelo domínio. O domínio declara **o que** precisa (`findById`, `save`), sem saber **como** (Prisma, SQL, memória):

```ts
// identity/domain/user.repository.ts
export abstract class UserRepository {
  abstract findByEmail(email: Email): Promise<User | null>
  abstract findById(id: number): Promise<User | null>
  abstract create(props: NewUserProps, stamp: Stamp): Promise<User>  // o banco gera o id
  abstract save(user: User): Promise<void>
}
```

**Domain service (serviço de domínio).** Uma regra que não pertence naturalmente a uma entidade só. Exemplo: **AccessPolicy** decide se um ator (um User com a Membership dele, ou o Super admin) pode executar uma ação num Group, num Event ou num Event item. Envolve várias coisas, então vira um serviço de domínio puro, sem Nest nem Prisma.

**Domain event (evento de domínio).** Um fato que aconteceu, nomeado no passado (`EventItemChanged`, `EventPublished`), que outros contextos podem querer saber. Quem publica não sabe quem escuta: o contexto dos Event items anuncia "um Event item mudou" e o de notificações decide quem avisar. Ver a seção 5.6 para o uso aqui.

---

## 3. Clean Architecture

Proposta por Robert C. Martin ("Uncle Bob"). A ideia é organizar o código em **camadas concêntricas**, com uma regra só:

> **A regra da dependência: o código só aponta para dentro.** Camadas internas não sabem que as externas existem.

```
        ┌──────────────────────────────────────────┐
        │  presentation   (controllers, DTOs Zod)  │
        │  ┌────────────────────────────────────┐  │
        │  │ infrastructure (Prisma, bcrypt,    │  │
        │  │                 JWT, Resend...)    │  │
        │  │  ┌──────────────────────────────┐  │  │
        │  │  │ application  (use cases,     │  │  │
        │  │  │               ports)         │  │  │
        │  │  │  ┌────────────────────────┐  │  │  │
        │  │  │  │ domain (entities, VOs, │  │  │  │
        │  │  │  │ repositories, regras)  │  │  │  │
        │  │  │  └────────────────────────┘  │  │  │
        │  │  └──────────────────────────────┘  │  │
        │  └────────────────────────────────────┘  │
        └──────────────────────────────────────────┘
                 dependências apontam para dentro →
```

### 3.1 As quatro camadas

| Camada | O que mora aqui | Pode importar | **Não** pode importar |
|---|---|---|---|
| **domain** | Entities, value objects, ports de repositório, domain services, erros de domínio | Só o próprio domínio e `shared/domain` | Nest, Prisma, Zod, bcrypt, qualquer lib de infraestrutura |
| **application** | Use cases (um por ação) e ports de serviços técnicos (`PasswordHasher`, `TokenIssuer`, `MediaStorage`) | domain | Nest HTTP, Prisma, Zod |
| **infrastructure** | Implementações dos ports: `PrismaUserRepository`, `BcryptPasswordHasher`, `JwtTokenIssuer`, adaptadores do Resend e do Cloudinary | application, domain, libs externas | presentation |
| **presentation** | Controllers, DTOs Zod, presenters (entidade → JSON), guards e filters HTTP | application (use cases) | infrastructure diretamente, Prisma |

O `*.module.ts` do Nest é a exceção: ele é o "composition root", o único lugar que conhece todas as camadas, porque é ali que se diz "quando alguém pedir `UserRepository`, entregue `PrismaUserRepository`".

### 3.2 Por que isso importa

- **Testar sem banco.** O `LoginUseCase` depende de `UserRepository` e `PasswordHasher` (abstrações). No teste, passamos versões em memória e testamos a regra em milissegundos.
- **Trocar tecnologia sem reescrever regra.** Trocamos Hono por NestJS antes de começar. Com o domínio isolado, uma troca dessas no futuro mexeria só em presentation e em infrastructure. Mesma coisa se o Cloudinary for trocado, ou se o push sair do Expo: é um adaptador novo, o ciclo de vida do Event item não muda.
- **Saber onde procurar.** Regra de negócio? `domain`. Fluxo de uma ação? `application/use-cases`. Formato do JSON? `presentation`.

### 3.3 Ports and adapters (o "como" da regra da dependência)

Se o use case precisa gerar hash de senha, mas não pode importar o bcrypt, como faz? Ele declara uma **porta** (port), uma abstração do que precisa, e a infraestrutura fornece um **adaptador** (adapter), a implementação:

```ts
// identity/application/ports/password-hasher.ts  (PORT: camada interna)
export abstract class PasswordHasher {
  abstract hash(plain: string): Promise<string>
  abstract compare(plain: string, hash: string | null): Promise<boolean>  // null: User inexistente, ainda gasta o tempo de um compare
}

// identity/infrastructure/bcrypt-password-hasher.ts  (ADAPTER: camada externa)
@Injectable()
export class BcryptPasswordHasher extends PasswordHasher {
  hash(plain: string) { return bcrypt.hash(plain, 10) }
  compare(plain: string, hash: string) { return bcrypt.compare(plain, hash) }
}

// identity/identity.module.ts  (COMPOSITION ROOT: liga um no outro)
providers: [{ provide: PasswordHasher, useClass: BcryptPasswordHasher }]
```

**Por que `abstract class` e não `interface`?** Interfaces do TypeScript somem na compilação, então o Nest não consegue usá-las como chave de injeção (precisaria de `@Inject(SYMBOL)` em todo lugar). Uma `abstract class` existe em runtime e serve de token direto: `constructor(private hasher: PasswordHasher)`.

---

## 4. SOLID na prática

| Princípio | Em uma frase | Onde aparece aqui |
|---|---|---|
| **S**ingle Responsibility | Uma classe, um motivo para mudar | Um use case por ação (`LoginUseCase`, `CancelEventItemUseCase`). O controller só traduz HTTP; o presenter só formata JSON. |
| **O**pen/Closed | Aberto para extensão, fechado para modificação | Um novo canal de notificação (push, e-mail) entra como um novo adaptador, sem mexer em quem decide o que avisar. |
| **L**iskov Substitution | Qualquer implementação de um contrato funciona no lugar de outra | `InMemoryRateLimitStore` (testes) e `UpstashRateLimitStore` (produção) são intercambiáveis para o `RateLimiter`. |
| **I**nterface Segregation | Contratos pequenos e focados | `PasswordHasher` e `TokenIssuer` são ports separados, em vez de um `AuthService` gigante. |
| **D**ependency Inversion | Dependa de abstrações, não de implementações | Use cases dependem de `UserRepository` (abstrato), nunca de `PrismaUserRepository`. |

---

## 5. Como fica a events-api

### 5.1 Estrutura de pastas

```
src/
  modules/
    identity/
      domain/
        user.entity.ts
        user.repository.ts              # port
      application/
        ports/
          password-hasher.ts            # port
          token-issuer.ts               # port
        use-cases/
          login.use-case.ts
          login.use-case.spec.ts        # teste unitário ao lado
          get-current-user.use-case.ts
      infrastructure/
        prisma-user.repository.ts       # adapter (+ mapper Prisma ↔ User)
        bcrypt-password-hasher.ts
        jwt-token-issuer.ts
        jwt.strategy.ts
      presentation/
        auth.controller.ts
        me.controller.ts
        dto/login.dto.ts                # Zod mora só aqui
        user.presenter.ts
      identity.module.ts                # composition root do módulo
      index.ts                          # API pública do módulo (única porta para os outros)
    events/                             # mesma estrutura (V1; os módulos do pivô estão em definição)
  shared/
    domain/            # AppError, Email, Stamp
    application/       # ports compartilhados (RateLimiter...)
    infrastructure/    # PrismaService, config, UpstashRateLimitStore
    presentation/      # filter global de erros, CredentialsGuard (JWT ou X-Api-Key), @Public, @AcceptsApiToken, @CurrentUser
  app.module.ts
  main.ts
test/
  integration/         # testes HTTP contra Postgres real
```

### 5.2 Convenções de nomes

- Arquivos em kebab-case com sufixo de papel: `.entity`, `.vo`, `.repository`, `.use-case`, `.controller`, `.dto`, `.presenter`, `.module`, `.spec`, e os papéis do Nest `.service`, `.strategy`, `.guard`, `.filter`, `.decorator`.
- Arquivos sem um papel único ficam sem sufixo, com nome do que fazem: `app-config.ts`, `error-catalog.ts`, `security.ts`, `docs.ts`, `password-policy.ts`.
- Adaptadores prefixados pela tecnologia: `prisma-`, `bcrypt-`, `jwt-`, `resend-`, `cloudinary-`, `upstash-`, `in-memory-`, e `in-process-` para o que chama outro contexto (ou código) dentro do mesmo processo (`in-process-user-directory.ts`, `InProcessEventPublisher`). Dublês de teste de ports técnicos que não guardam estado real usam `fake-` (`fake-password-hasher.ts`), e ficam em `application/testing/`.
- Classes com os termos do `CONTEXT.md`: `EventItem`, `Field`, `GroupMember`. Nunca os termos da lista "_Avoid_".

### 5.3 O caminho de uma requisição: `POST /api/v1/auth/login`

```
HTTP ─► AuthController (presentation)
          │  LoginDto (Zod) já validou o corpo
          ▼
        LoginUseCase.execute({ email, password })   (application)
          │  Email.create(email)          → value object normaliza
          │  users.findByEmail(email)     → port; em runtime é PrismaUserRepository
          │  hasher.compare(...)          → port; em runtime é BcryptPasswordHasher
          │  falhou? throw AppError('INVALID_CREDENTIALS')
          │  tokens.issue(user)           → port; em runtime é JwtTokenIssuer
          ▼
        { token, user: User }
          ▼
AuthController ─► UserPresenter.toJson(user) ─► { data: { token, user } }
```

Se algo lança `AppError`, o filter global (presentation) consulta o catálogo, descobre o status HTTP (`INVALID_CREDENTIALS` → 401) e monta `{ error: { code, message } }`.

### 5.4 Erros

- `AppError` mora em `shared/domain` e carrega **só o código** (`new AppError('EVENT_ITEM_NOT_PUBLISHED')`). O domínio não sabe o que é HTTP.
- O catálogo que traduz código → status HTTP + mensagem fica em `shared/presentation`, e é usado pelo filter global.
- Contrato de resposta: ADR-0008.
- Na doc, cada rota lista os códigos que pode responder com `@ApiErrors(...)` (ver §5.9).

### 5.5 Comunicação entre contextos

Existem três jeitos, e cada um tem seu caso (ADR-0010):

| Situação | Mecanismo | Exemplo |
|---|---|---|
| Preciso de uma **resposta** de outro contexto | Chamada direta ao que o outro módulo **exporta** no `*.module.ts` | Todo contexto pergunta à AccessPolicy se a ação é permitida |
| Uma regra minha exige que o dono de um dado o **escreva agora**, e preciso do resultado | Chamada direta a um serviço de comandos que o dono exporta num módulo próprio | Um Owner adiciona um Group member por email e o `identity` cria o Pending user, devolvendo o Activation link; ao remover o último vínculo, quem removeu pede ao `identity` que derrube o link |
| Aconteceu um **fato** e outro contexto reage | Domain event | O contexto dos Event items publica `EventItemChanged`; o de notificações agenda o aviso |

O que separa um comando de um domain event: no comando, a escrita faz parte da regra de quem chama, que precisa dela concluída (ou do resultado) antes de responder. No domain event, quem publica não sabe nem se importa com quem reage. Quem executa o comando continua dono do dado e das próprias invariantes; a autorização é de quem chama.

Regra de fronteira: um módulo só usa o que outro **exporta**. Nunca importa arquivos de `domain/`, `application/` ou `infrastructure/` de outro módulo.

### 5.6 Domain events

O fluxo, sempre nesta ordem:

```
CancelEventItemUseCase.execute()
  1. item.cancel(stamp)                 → a entidade registra EventItemChanged internamente
  2. await items.save(item)             → grava no banco (commit)
  3. await events.publish(item.pullEvents())   → SÓ DEPOIS do commit
                │
                ▼  InProcessEventPublisher (shared/infrastructure)
          waitUntil(handler(event))     → roda depois da resposta, sem ser congelado
                │
                ▼
      <notificações>/application/handlers/on-event-item-changed.handler.ts
          → agenda o aviso para quem o Event item alcança
```

Regras:
- **Publicar só depois de salvar.** Publicar antes arrisca avisar de uma mudança que não foi gravada.
- **Handler que falha nunca derruba a ação.** O publisher captura e loga o erro; o cancelamento já respondeu `200`.
- **Melhor esforço, em processo.** Se a função cair entre o commit e o handler, o evento se perde. Não há fila nem outbox. Por isso, nada que não possa se perder (como uma Change do Change log) depende de um handler (emenda do ADR-0010).
- **Nome no passado, dados mínimos.** O evento carrega ids e o essencial (`{ eventId, eventItemId, occurredAt }`); o handler busca o resto se precisar.
- **Evento é para fato com efeito em outro contexto.** Não use evento para chamar código do próprio módulo, nem para pedir uma resposta.

Arquivos: `shared/domain/domain-event.ts` (tipo base e `AggregateRoot` com `record()`/`pullEvents()`), `shared/application/ports/event-publisher.ts` (port), `shared/infrastructure/in-process-event-publisher.ts` (adapter), e os eventos no `domain/events/` do contexto que os publica (`<contexto>/domain/events/event-item-changed.event.ts`).

### 5.7 Onde cada teste mora

| Camada | Tipo de teste | Dependências |
|---|---|---|
| domain | Unitário, puro | Nenhuma |
| application | Unitário, com ports falsos em memória | Nenhuma real |
| infrastructure | Coberto pelos testes de integração | Postgres real |
| presentation + tudo junto | Integração HTTP (`test/integration/`) | Postgres real, Resend/Cloudinary com dublês |

### 5.8 Autoria dos registros (toda tabela)

**Toda tabela guarda quem criou e quem editou por último cada registro, e quando** (ADR-0013). Isso vale para as tabelas que já existem e é o padrão de toda tabela nova: um model sem autoria é incompleto.

| Coluna | O que guarda |
|---|---|
| `createdAt` | Quando o registro foi criado |
| `updatedAt` | Quando foi editado pela última vez |
| `createdById` | O Author da criação: FK anulável para `users`, `onDelete: Restrict` |
| `updatedById` | O Author da última escrita: FK anulável para `users`, `onDelete: Restrict` |

- **`null` quer dizer que a escrita não partiu de um User**: scripts da plataforma (`create-super-admin`) e processos automáticos. Nunca quer dizer "não sei".
- **Toda escrita persistida na linha atualiza `updatedAt`/`updatedById`**, inclusive as técnicas (troca de senha, uso de um Activation link, archive). Na criação, `updatedById = createdById`. A exceção é o registro de uso (ex.: o último login), que não é edição e grava só a própria coluna (ADR-0013).
- **O `Stamp` carrega autor e hora juntos** (`shared/domain/stamp.ts`: `{ by: number | null, at: Date }`). Toda mutação de entidade recebe um (`event.update(changes, stamp)`, `user.changePassword(hash, stamp)`), e todo `create` de repositório também (`users.create(props, stamp)`). Sem default: o compilador impede que alguém esqueça o Author.
- **A hora vem da porta `Clock`** (`shared/application/clock.ts`), injetada pelo Nest (`SystemClock`, no `SharedModule`) e trocada por `FixedClock` nos testes. Use case e entidade nunca chamam `new Date()`. O use case monta o stamp: `{ by: input.actor.id, at: this.clock.now() }`.
- O repositório Prisma grava as quatro colunas explicitamente. Na criação, use `...createdWith(stamp)` (`shared/domain/stamp.ts`, também usado pelos repositórios em memória); no `save`, passe `updatedAt` e `updatedById` da entidade.
- As colunas guardam só o **último** editor. O histórico de um Event (quem mudou o quê, antes e depois) é o **Change log**, um conceito do domínio, e não estas colunas (emenda do ADR-0013).
- A API ainda **não expõe** a autoria: ela é gravada, e os testes de integração leem a linha no banco.

**Soft delete, caso a caso.** Um registro ganha soft delete (fica marcado, nunca some) quando outros registros dependem dele como histórico ou quando ele envolve dinheiro. Hoje isso vale só para `users`, porque um User nunca é apagado: ele é desativado (Deactivated user) e continua sendo o Author do que fez. As demais tabelas apagam de verdade.

### 5.9 Documentação da API (Scalar)

O Scalar (`/api/v1/docs`, com `DOCS_ENABLED=true`) é gerado do código e é a interface de teste manual da API. Toda rota entra nele completa, e o `test/integration/docs.spec.ts` barra o PR que esquecer algo (emenda do ADR-0009):

| O que | Onde | Exemplo |
|---|---|---|
| Resumo (e descrição, quando houver regra de acesso ou efeito colateral) | `@ApiOperation` no método do controller | `@ApiOperation({ summary: 'Criar um User', description: 'Só o Super admin. ...' })` |
| Erros de negócio | `@ApiErrors(...)` em **todo** método, com os códigos que o use case e a AccessPolicy lançam; `@ApiErrors()` quando não há nenhum | `@ApiErrors('FORBIDDEN', 'EMAIL_ALREADY_IN_USE')` |
| Exemplo de cada campo do request body | `.meta({ example })` no schema Zod do DTO | `email: z.email().meta({ example: 'maria@local.test' })` |
| Descrição de campo, quando o nome não basta | `.meta({ description })` (comentário JSDoc não vira doc) | `timezone: ... .meta({ description: 'Fuso IANA do lugar: ...' })` |

- 401 `UNAUTHENTICATED` (rota sem `@Public()`) e 400 `VALIDATION_ERROR` (rota com body, path ou query) entram sozinhos; não declare.
- O status e a mensagem de cada código vêm do `ERROR_CATALOG`. Código novo aparece na doc sem editar nada além do catálogo.
- Textos em português, termos do glossário em inglês.
- Exemplos que funcionam contra o seed local, sem que executar um quebre outro (a troca de senha usa a mesma senha do seed como nova). Valor que só existe em tempo de execução (token de ativação) usa um placeholder descritivo. Nunca uma credencial real.
- Rota que não deve aparecer na doc (`@ApiExcludeController`) entra na allowlist `UNDOCUMENTED_ROUTES` do `docs.spec.ts`, com o motivo.

---

## 6. Nossa escolha pragmática ("DDD pragmático")

Clean Architecture levada ao pé da letra gera muita cerimônia: um CRUD simples vira 6 a 8 arquivos com entidades que não fazem nada ("modelo anêmico fingindo ser rico"). Por isso:

- **Estrutura igual em todos os módulos**: as quatro camadas, ports e a regra da dependência valem sempre.
- **Entidades ricas só onde há regra de verdade**: Event e Event item (Draft, publicado, Cancelled), membros do Group (o último Owner), AccessPolicy, value objects como `Email`.
- **Onde não há regra** (Saved place, Team), a "entidade" pode ser só um tipo com os dados, e o use case só orquestra o repositório. Continua passando por port e use case, mas sem inventar comportamento.

A pergunta para decidir: *"existe uma regra que pode ser quebrada se alguém alterar esse dado diretamente?"* Se sim, entidade rica. Se não, tipo simples.

### Erros comuns a evitar

- Importar `@prisma/client` em `domain/` ou `application/`. É o sintoma número 1 de que a regra da dependência quebrou.
- Colocar regra de negócio no controller ("se o status for X, então...").
- Use case chamando outro use case em cadeia. Se a lógica é compartilhada, provavelmente é um domain service.
- Entidade com `setStatus()` público. Prefira métodos com nome do negócio: `publish()`, `cancel()`, `archive()`.
- `shared` virando depósito de tudo. Se tem regra de negócio, tem dono.

---

## 7. Fiscalização por lint

A regra da dependência não depende de disciplina: o ESLint barra as violações no editor e no CI.

- **Camadas** (`eslint-plugin-boundaries`): `domain` → só `domain` e `shared/domain`; `application` → + `domain`; `infrastructure` → + `application`; `presentation` → `application` (não `infrastructure`). O `*.module.ts` é a exceção, por ser o composition root.
- **Bibliotecas** (`no-restricted-imports` por pasta): em `domain/` e `application/` são proibidos `@prisma/*`, `@nestjs/*`, `zod`, `bcryptjs`, `resend`, `cloudinary` e afins. Por isso entidades, domain services e use cases **não têm `@Injectable()`**: o `*.module.ts` os registra com `useFactory` ou `useClass`.
- **Fronteira entre módulos**: cada módulo tem um `index.ts` que é a sua API pública (o módulo Nest, o que ele oferece para consulta e os seus domain events). Outros módulos importam só o `index.ts` (`../../<nome>/index.js`), nunca uma pasta interna.

Se o lint reclamar, a pergunta não é "como calo o lint?", e sim "em que camada esse código deveria estar?".

---

## Para aprofundar

- Eric Evans, *Domain-Driven Design* (2003): o livro original, denso. Comece pelos capítulos de linguagem ubíqua e bounded context.
- Vaughn Vernon, *Domain-Driven Design Distilled*: a versão curta e prática.
- Robert C. Martin, *Clean Architecture* (2017), e o post "The Clean Architecture" (2012) no blog dele.
- Alistair Cockburn, "Hexagonal Architecture" (ports and adapters), a ideia que inspirou a Clean Architecture.
