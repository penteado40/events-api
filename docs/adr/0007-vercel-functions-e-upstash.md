# Deploy em Vercel Functions, com rate limit no Upstash Redis

A API roda como Vercel Functions (runtime Node.js, app NestJS; ver ADR-0009), no lugar de um servidor Node sempre ligado: menos infraestrutura, deploy por push e o mesmo provedor dos Sites. Consideramos Cloudflare Workers (runtime incompatível com o SDK do Cloudinary e exigindo driver adapter no Prisma) e AWS Lambda (mais infraestrutura para gerenciar).

Em serverless, cada instância tem memória própria, então o rate limiter em memória da API antiga deixa de valer. Os contadores ficam no **Upstash Redis** (`@upstash/redis`, via HTTP), atrás de uma interface `RateLimitStore`. Existe uma implementação em memória para os testes, usada também em desenvolvimento quando o Upstash não está configurado, e o Postgres fica como plano B.

O store é primitivo: só incrementa o contador de uma chave com expiração. O algoritmo (janela fixa, com a janela atual calculada pelo `Clock` e embutida na chave) fica no `RateLimiter`, que é nosso, para que os testes exercitem a mesma lógica que roda em produção. Consideramos o `@upstash/ratelimit` (janela deslizante e atômica em Lua), mas com ele o algoritmo ficaria dentro do adaptador e os testes com relógio injetável cobririam só o dublê. A janela fixa admite até o dobro do limite na virada da janela, o que é aceitável para login e para as rotas de Guest. Também aceitamos que o limite de falhas por email (checado antes da senha e contado depois da falha) não é atômico: tentativas paralelas podem passar um pouco do limite, mas continuam presas ao limite por IP.

## Consequences

- Se o Upstash falhar, o rate limit deixa a requisição passar e registra o erro (fail open): é uma defesa extra, e quem autoriza continua sendo a senha ou o API token. Em produção as credenciais do Upstash são obrigatórias, para que a proteção nunca caia em silêncio no store em memória.
- Trabalho que termina depois da resposta, como o envio de email após o RSVP, precisa usar `waitUntil` (`@vercel/functions`). Um `void promise` pode ser congelado junto com a função.
- Corpo da requisição limitado a 4,5 MB: arquivos grandes vão direto ao Cloudinary (ADR-0005).
- Conexões com o Neon usam a URL com pooler.
- O plano Hobby da Vercel é para uso não comercial; se a plataforma virar produto, é preciso migrar para o Pro.
- O CORS aceita automaticamente o `siteUrl` de todo Event, ativo ou arquivado (com cache), além das origens extras da env, para que um evento novo não exija redeploy. O arquivado continua no CORS porque o Site segue lendo a parte pública dele (ADR-0011); o CORS só protege o navegador, e quem autoriza é o API token.
