# Contribuição amarrada a um token por transação, com conferência pelo membro

Na `fawedding-api`, o token público do site podia confirmar e cancelar **qualquer** pagamento pelo id sequencial, e "confirmado" significava só que alguém clicou em "finalizei o pagamento". Na nova API, ao abrir uma Contribution, o Guest recebe uma única vez um **Contribution token** (a API guarda só o hash). Abandonar ou marcar como paga exige esse token no header `X-Contribution-Token` e só vale para Contributions `PENDING`.

Separamos a declaração do Guest da checagem real: `PENDING → ABANDONED` ou `PENDING → PAID` (ação do Guest) e `PAID → VERIFIED | REJECTED` (Verification por um membro Manager ou superior). Como ainda não há verificação automática de Pix, `PAID` nunca é tratado como prova. Uma integração futura com um PSP pode fazer `PAID → VERIFIED` via webhook sem mudar o modelo.

## Consequences

- O fluxo do modal de Pix nos Sites muda: "tentar de novo com outros dados" vira `abandon` + novo `create`; "finalizei o pagamento" vira `mark-paid`.
- Contributions `PENDING` antigas (o Guest fechou a aba sem disparar `abandon`) não são limpas por job; o painel apenas as oculta depois de algumas horas.
- Contributions migradas da API antiga não têm Contribution token, então só membros podem alterá-las.
