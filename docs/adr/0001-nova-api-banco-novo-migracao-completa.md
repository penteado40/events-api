# Nova API com banco novo e migração completa da fawedding-api

A `fawedding-api` foi modelada só para casamentos (`Wedding`, templates de email por casal escritos no código, lista de presentes obrigatória), mas já atende um aniversário (evento 4). Decidimos criar a `events-api` em um repositório e um banco (projeto Neon) novos, em vez de renomear o modelo no mesmo banco: a API antiga continua intacta como rollback, e uma migração em lugar exigiria virada simultânea de API e frontends. Todo o histórico (casamentos 1 e 2 como eventos arquivados, e o evento 4 ativo) é copiado por um script único e idempotente. Depois é só apontar os frontends para a nova API; não há janela de virada nem ensaio em staging.

## Consequences

- O script de migração lê o banco antigo por uma `OLD_DATABASE_URL` (idealmente um usuário só de leitura) e deixa as sequences ajustadas (`setval`), para que o próximo evento criado não colida com os ids migrados.
- `gift_payments` com status `CONFIRMED` na API antiga viram `PAID`, e não `VERIFIED`: lá, "confirmado" só queria dizer que o convidado clicou em um botão (ver ADR-0004).
- A coluna `api_tokens.token` (token em texto puro) não é migrada; só o `tokenHash`.
