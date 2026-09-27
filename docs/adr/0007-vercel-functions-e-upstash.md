# Deploy em Vercel Functions, com rate limit no Upstash Redis

A API roda como Vercel Functions (runtime Node.js, app NestJS; ver ADR-0009), no lugar de um servidor Node sempre ligado: menos infraestrutura, deploy por push e o mesmo provedor dos Sites. Consideramos Cloudflare Workers (runtime incompatível com o SDK do Cloudinary e exigindo driver adapter no Prisma) e AWS Lambda (mais infraestrutura para gerenciar).

Em serverless, cada instância tem memória própria, então o rate limiter em memória da API antiga deixa de valer. Os contadores ficam no **Upstash Redis** (`@upstash/ratelimit`, via HTTP), atrás de uma interface `RateLimitStore`. Existe uma implementação em memória só para testes, e o Postgres fica como plano B.

## Consequences

- Trabalho que termina depois da resposta, como o envio de email após o RSVP, precisa usar `waitUntil` (`@vercel/functions`). Um `void promise` pode ser congelado junto com a função.
- Corpo da requisição limitado a 4,5 MB: arquivos grandes vão direto ao Cloudinary (ADR-0005).
- Conexões com o Neon usam a URL com pooler.
- O plano Hobby da Vercel é para uso não comercial; se a plataforma virar produto, é preciso migrar para o Pro.
- O CORS aceita automaticamente o `siteUrl` dos eventos ativos (com cache), além das origens extras da env, para que um evento novo não exija redeploy.
