# Emails saem de um remetente único da plataforma

Na `fawedding-api`, o remetente era `noreply@<host do siteUrl>`, o que exigia verificar no Resend o domínio de cada evento. Isso não funciona para Sites sem domínio próprio (o evento 4 só tem uma URL da Vercel) e esbarra no limite de domínios do plano do Resend. Todos os emails passam a sair de um **Platform sender** configurado por env (`EMAIL_FROM_ADDRESS`), hoje em um subdomínio de `fawedding.com.br`. O nome exibido é o do evento, e o `replyTo` aponta para quem organiza (por padrão, o email do Primary owner). Um evento com domínio próprio verificado pode sobrescrever o remetente.

## Consequences

- Quando `fawedding.com.br` expirar, a troca para um domínio próprio da plataforma exige apenas DNS no Resend e uma mudança de env.
- Os textos dos emails ficam no código, por Email kind × Event type × idioma, com sobrescritas opcionais por evento (`subject`, `headline`, `message`, `ctaLabel`). Não há templates livres em HTML no banco.

## Emenda: pivô para Groups (2026-10-02)

O remetente único da plataforma continua valendo (ADR-0016). Deixam de valer as partes que dependiam dos Sites: o nome exibido "do evento", o `replyTo` padrão no Primary owner (que não existe mais, ADR-0017), o remetente próprio de um evento com domínio verificado e os textos por Event type. Quais e-mails existem no modelo novo, o nome exibido e o `replyTo` ficam para o ticket "E-mails no modelo novo" (PROJ-118).
