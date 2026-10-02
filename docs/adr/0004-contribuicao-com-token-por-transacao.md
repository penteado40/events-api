# Contribuição amarrada a um token por transação, com conferência pelo membro

Na `fawedding-api`, o token público do site podia confirmar e cancelar **qualquer** pagamento pelo id sequencial, e "confirmado" significava só que alguém clicou em "finalizei o pagamento". Na nova API, ao abrir uma Contribution, o Guest recebe uma única vez um **Contribution token** (a API guarda só o hash). Abandonar ou marcar como paga exige esse token no header `X-Contribution-Token` e só vale para Contributions `PENDING`.

Separamos a declaração do Guest da checagem real: `PENDING → ABANDONED` ou `PENDING → PAID` (ação do Guest) e `PAID → VERIFIED | REJECTED` (Verification por um membro Manager ou superior). Como ainda não há verificação automática de Pix, `PAID` nunca é tratado como prova. Uma integração futura com um PSP pode fazer `PAID → VERIFIED` via webhook sem mudar o modelo.

## Consequences

- O fluxo do modal de Pix nos Sites muda: "tentar de novo com outros dados" vira `abandon` + novo `create`; "finalizei o pagamento" vira `mark-paid`.
- Contributions `PENDING` antigas (o Guest fechou a aba sem disparar `abandon`) não são limpas por job; o painel apenas as oculta depois de algumas horas.
- Contributions migradas da API antiga não têm Contribution token, então só membros podem alterá-las.

## Refinamento: a Verification pode ser revista

O texto original tratava `VERIFIED` e `REJECTED` como finais. Na prática, quem confere olha o extrato num dado momento: um Pix que ainda não apareceu é rejeitado e, dias depois, aparece; ou um Pix é verificado olhando a linha errada do extrato. Decidimos que a Verification pode ser **revista nos dois sentidos**: `verify` vale a partir de `PAID` ou `REJECTED`, e `reject` a partir de `PAID` ou `VERIFIED`. Quem pode rever é quem pode conferir (com a mesma regra do evento arquivado, ADR-0011), e cada revisão sobrescreve `verifiedAt` e quem conferiu.

- Pedir o status em que a Contribution já está é idempotente: `200` com ela como está, sem mudar `verifiedAt` nem quem conferiu (o mesmo padrão de `archive`/`unarchive`). Dois membros que conferem a mesma Contribution ao mesmo tempo chegam ao mesmo resultado sem erro.
- `verify` ou `reject` de uma Contribution `PENDING` ou `ABANDONED` continua recusado (`409 CONTRIBUTION_NOT_PAID`): sem a declaração do Guest, não há o que conferir.
- Uma Contribution nunca volta a `PAID`: rever é trocar uma decisão pela outra, não devolver à fila.
- A atualização condicional pelo status atual continua valendo, agora com mais de um status de origem.
