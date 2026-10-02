# Deploy em Vercel Functions, com rate limit no Upstash Redis

A API roda como Vercel Functions (runtime Node.js, app NestJS; ver ADR-0009), no lugar de um servidor Node sempre ligado: menos infraestrutura, deploy por push e o mesmo provedor dos Sites. Consideramos Cloudflare Workers (runtime incompatível com o SDK do Cloudinary e exigindo driver adapter no Prisma) e AWS Lambda (mais infraestrutura para gerenciar).

Em serverless, cada instância tem memória própria, então o rate limiter em memória da API antiga deixa de valer. Os contadores ficam no **Upstash Redis** (`@upstash/ratelimit`, via HTTP), atrás de uma interface `RateLimitStore`. Existe uma implementação em memória só para testes, e o Postgres fica como plano B.

## Consequences

- Trabalho que termina depois da resposta, como o envio de email após o RSVP, precisa usar `waitUntil` (`@vercel/functions`). Um `void promise` pode ser congelado junto com a função.
- Corpo da requisição limitado a 4,5 MB: arquivos grandes vão direto ao Cloudinary (ADR-0005).
- Conexões com o Neon usam a URL com pooler.
- O plano Hobby da Vercel é para uso não comercial; se a plataforma virar produto, é preciso migrar para o Pro.
- O CORS aceita automaticamente o `siteUrl` de todo Event, ativo ou arquivado (com cache), além das origens extras da env, para que um evento novo não exija redeploy. O arquivado continua no CORS porque o Site segue lendo a parte pública dele (ADR-0011); o CORS só protege o navegador, e quem autoriza é o API token.

## Emenda: pivô para Groups (2026-10-02)

Vercel Functions e o rate limit no Upstash continuam valendo. Sem Sites (ADR-0016), o CORS deixa de aceitar o `siteUrl` de cada Event e fica só com as origens da env; o app mobile (events-expo) não passa por CORS. O exemplo do `waitUntil` depois do RSVP perde o objeto, mas a regra continua: trabalho depois da resposta usa `waitUntil`. O envio agrupado de notificações pode usar o QStash como despertador (pesquisa em PROJ-116), o que se decide no ticket de notificações (PROJ-75).
