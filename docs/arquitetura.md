# Arquitetura: Clean Architecture, DDD e SOLID na events-api

Este documento explica **o que** são os padrões que usamos, **por que** eles existem e **como** se aplicam aqui, sempre com exemplos da própria events-api. Serve de guia para quem está aprendendo os padrões e de referência para quem (pessoa ou agente) vai escrever código no projeto.

Decisões relacionadas: ADR-0009 (NestJS). Vocabulário do domínio: [`CONTEXT.md`](../CONTEXT.md).

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

**Linguagem ubíqua (ubiquitous language).** Um vocabulário único, usado na conversa, nas issues, nos testes e no código. O nosso é o [`CONTEXT.md`](../CONTEXT.md). Se o glossário diz **Contribution**, a classe é `Contribution`, e não `GiftPayment` nem `Payment`. Se diz **Verification**, o caso de uso é `VerifyContributionUseCase`, e não `ConfirmPayment`. Quando uma palavra nova aparece no código e não está no glossário, ou estamos inventando linguagem ou o glossário tem uma lacuna.

**Bounded context (contexto delimitado).** Uma fronteira dentro da qual cada termo tem um significado só. Na events-api, cada contexto vira um módulo:

| Módulo | Responsável por |
|---|---|
| `identity` | Users, login, senha |
| `events` | Event, Event members e papéis, API tokens e Scopes, AccessPolicy |
| `rsvp` | RSVPs |
| `registry` | Registry items, Contributions, Receipts, Verification |
| `emails` | Email kinds, configurações, Email log, envio |
| `shared` | Não é contexto: a base comum (erros, value objects genéricos, Prisma, config) |

Regra prática: **cada regra de negócio tem um dono**. "Só o Primary owner remove outro Owner" é do `events`. "Só dá para marcar como paga uma Contribution `PENDING`" é do `registry`. Nada disso vai para o `shared`.

### 2.2 DDD tático (as peças)

**Entity (entidade).** Um objeto com **identidade** que atravessa o tempo: duas Contributions com o mesmo valor e o mesmo nome continuam sendo Contributions diferentes, porque têm ids diferentes. Uma entidade rica **protege as próprias regras**:

```ts
// registry/domain/contribution.entity.ts (exemplo)
export class Contribution {
  private constructor(private props: ContributionProps) {}

  markPaid(receipt?: Receipt): void {
    if (this.props.status !== 'PENDING') {
      throw new AppError('CONTRIBUTION_NOT_PENDING')
    }
    this.props.status = 'PAID'
    this.props.paidAt = new Date()
    this.props.receipt = receipt ?? null
  }
}
```

Não existe `contribution.status = 'PAID'` solto pelo código: a única forma de chegar em `PAID` é passando pela regra.

**Value object (objeto de valor).** Um objeto **sem identidade**, definido só pelo valor, e **imutável**. Dois `Money(60, 'BRL')` são iguais. Serve para dar nome e validação a algo que seria só um primitivo:

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

**Aggregate (agregado).** Um grupo de objetos tratado como uma unidade de consistência, com uma **raiz** que é a única porta de entrada. Exemplo: se as regras de membros (no máximo um Primary owner, ninguém se promove) precisam olhar todos os membros de um Event de uma vez, os membros formam um agregado, e toda mudança passa pela raiz, que valida o conjunto. Regras de ouro:
- Outros agregados são referenciados **pelo id**, não pelo objeto (a Contribution guarda `registryItemId`, não o `RegistryItem`).
- Uma transação altera **um** agregado.

**Repository (repositório).** A "coleção" de agregados, vista pelo domínio. O domínio declara **o que** precisa (`findById`, `save`), sem saber **como** (Prisma, SQL, memória):

```ts
// identity/domain/user.repository.ts
export abstract class UserRepository {
  abstract findByEmail(email: Email): Promise<User | null>
  abstract findById(id: number): Promise<User | null>
  abstract create(props: NewUserProps): Promise<User>  // o banco gera o id (ADR-0002)
  abstract save(user: User): Promise<void>
}
```

**Domain service (serviço de domínio).** Uma regra que não pertence naturalmente a uma entidade só. Exemplo: **AccessPolicy** decide se um ator (User com papel e vínculos, ou API token com Scopes) pode executar uma ação num Event. Envolve várias coisas, então vira um serviço de domínio puro, sem Nest nem Prisma.

**Domain event (evento de domínio).** Um fato que aconteceu, nomeado no passado (`RsvpConfirmed`, `ContributionMarkedPaid`), que outros contextos podem querer saber. Quem publica não sabe quem escuta: o `rsvp` anuncia "um RSVP foi confirmado" e o `emails` decide mandar a confirmação. Ver a seção 5.6 para o uso aqui.

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
- **Trocar tecnologia sem reescrever regra.** Trocamos Hono por NestJS antes de começar. Com o domínio isolado, uma troca dessas no futuro mexeria só em presentation e em infrastructure. Mesma coisa se o Cloudinary for trocado, ou quando vier o PSP de Pix (PROJ-77): é um adaptador novo, a máquina de estados da Contribution não muda.
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
| **S**ingle Responsibility | Uma classe, um motivo para mudar | Um use case por ação (`LoginUseCase`, `MarkContributionPaidUseCase`). O controller só traduz HTTP; o presenter só formata JSON. |
| **O**pen/Closed | Aberto para extensão, fechado para modificação | Um novo Email kind (V2) entra como um novo conjunto de textos, sem mexer no `EmailComposer`. A verificação via PSP entra como um novo adaptador. |
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
    events/  rsvp/  registry/  emails/  # mesma estrutura
  shared/
    domain/            # AppError, Email, Money
    application/       # ports compartilhados (RateLimiter...)
    infrastructure/    # PrismaService, config, UpstashRateLimitStore
    presentation/      # filter global de erros, JwtAuthGuard, @Public, @CurrentUser
  legacy-migration/    # ferramenta de migração (não é contexto)
  app.module.ts
  main.ts
test/
  integration/         # testes HTTP contra Postgres real
```

### 5.2 Convenções de nomes

- Arquivos em kebab-case com sufixo de papel: `.entity`, `.vo`, `.repository`, `.use-case`, `.controller`, `.dto`, `.presenter`, `.module`, `.spec`, e os papéis do Nest `.service`, `.strategy`, `.guard`, `.filter`, `.decorator`.
- Arquivos sem um papel único ficam sem sufixo, com nome do que fazem: `app-config.ts`, `error-catalog.ts`, `security.ts`, `docs.ts`, `password-policy.ts`.
- Adaptadores prefixados pela tecnologia: `prisma-`, `bcrypt-`, `jwt-`, `resend-`, `cloudinary-`, `upstash-`, `in-memory-`, e `in-process-` para o que chama outro contexto (ou código) dentro do mesmo processo (`in-process-user-directory.ts`, `InProcessEventPublisher`). Dublês de teste de ports técnicos que não guardam estado real usam `fake-` (`fake-password-hasher.ts`), e ficam em `application/testing/`.
- Classes com os termos do `CONTEXT.md`: `Contribution`, `RegistryItem`, `EventMember`. Nunca os termos da lista "_Avoid_".

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

- `AppError` mora em `shared/domain` e carrega **só o código** (`new AppError('CONTRIBUTION_NOT_PENDING')`). O domínio não sabe o que é HTTP.
- O catálogo que traduz código → status HTTP + mensagem fica em `shared/presentation`, e é usado pelo filter global.
- Contrato de resposta: ADR-0008.

### 5.5 Comunicação entre contextos

Existem dois jeitos, e cada um tem seu caso (ADR-0010):

| Situação | Mecanismo | Exemplo |
|---|---|---|
| Preciso de uma **resposta** de outro contexto | Chamada direta ao que o outro módulo **exporta** no `*.module.ts` | Todo contexto pergunta à AccessPolicy (`events`) se a ação é permitida |
| Aconteceu um **fato** e outro contexto reage | Domain event | `rsvp` publica `RsvpConfirmed`; `emails` envia a confirmação |

Regra de fronteira: um módulo só usa o que outro **exporta**. Nunca importa arquivos de `domain/`, `application/` ou `infrastructure/` de outro módulo.

### 5.6 Domain events

O fluxo, sempre nesta ordem:

```
RegisterRsvpUseCase.execute()
  1. rsvp = Rsvp.register(...)          → a entidade registra RsvpConfirmed internamente
  2. await rsvps.save(rsvp)             → grava no banco (commit)
  3. await events.publish(rsvp.pullEvents())   → SÓ DEPOIS do commit
                │
                ▼  InProcessEventPublisher (shared/infrastructure)
          waitUntil(handler(event))     → roda depois da resposta, sem ser congelado
                │
                ▼
      emails/application/handlers/on-rsvp-confirmed.handler.ts
          → cria o EmailLog e envia
```

Regras:
- **Publicar só depois de salvar.** Publicar antes arrisca mandar email de um RSVP que não foi gravado.
- **Handler que falha nunca derruba a ação.** O publisher captura e loga o erro; o RSVP já respondeu `201`.
- **Melhor esforço, em processo.** Se a função cair entre o commit e o handler, o evento se perde. Para emails, o Email log e o reenvio manual (PROJ-62) cobrem isso. Não há fila nem outbox.
- **Nome no passado, dados mínimos.** O evento carrega ids e o essencial (`{ eventId, rsvpId, occurredAt }`); o handler busca o resto se precisar.
- **Evento é para fato com efeito em outro contexto.** Não use evento para chamar código do próprio módulo, nem para pedir uma resposta.

Arquivos: `shared/domain/domain-event.ts` (tipo base e `AggregateRoot` com `record()`/`pullEvents()`), `shared/application/ports/event-publisher.ts` (port), `shared/infrastructure/in-process-event-publisher.ts` (adapter), e os eventos no `domain/events/` do contexto que os publica (`rsvp/domain/events/rsvp-confirmed.event.ts`).

### 5.7 Onde cada teste mora

| Camada | Tipo de teste | Dependências |
|---|---|---|
| domain | Unitário, puro | Nenhuma |
| application | Unitário, com ports falsos em memória | Nenhuma real |
| infrastructure | Coberto pelos testes de integração | Postgres real |
| presentation + tudo junto | Integração HTTP (`test/integration/`) | Postgres real, Resend/Cloudinary com dublês |

---

## 6. Nossa escolha pragmática ("DDD pragmático")

Clean Architecture levada ao pé da letra gera muita cerimônia: um CRUD simples vira 6 a 8 arquivos com entidades que não fazem nada ("modelo anêmico fingindo ser rico"). Por isso:

- **Estrutura igual em todos os módulos**: as quatro camadas, ports e a regra da dependência valem sempre.
- **Entidades ricas só onde há regra de verdade**: Contribution (máquina de estados), membros do Event (Primary owner), AccessPolicy, value objects como `Email` e `Money`.
- **Onde não há regra** (Registry item, configuração de email), a "entidade" pode ser só um tipo com os dados, e o use case só orquestra o repositório. Continua passando por port e use case, mas sem inventar comportamento.

A pergunta para decidir: *"existe uma regra que pode ser quebrada se alguém alterar esse dado diretamente?"* Se sim, entidade rica. Se não, tipo simples.

### Erros comuns a evitar

- Importar `@prisma/client` em `domain/` ou `application/`. É o sintoma número 1 de que a regra da dependência quebrou.
- Colocar regra de negócio no controller ("se o status for X, então...").
- Use case chamando outro use case em cadeia. Se a lógica é compartilhada, provavelmente é um domain service.
- Entidade com `setStatus()` público. Prefira métodos com nome do negócio: `markPaid()`, `verify()`, `archive()`.
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
