# Evento arquivado fica congelado, e só o Super admin desarquiva

O PRD previa que arquivar um Event recusasse apenas as escritas vindas do Site (`EVENT_ARCHIVED`), deixando os membros editarem normalmente. Decidimos que arquivar **congela o evento para todos**: qualquer escrita de membro (Owner, Manager) ou do Site num evento arquivado é recusada com `409 EVENT_ARCHIVED`, e só o Super admin escreve nele e o desarquiva (`POST /events/:id/unarchive`). Arquivar é encerrar: um evento que acabou não deve continuar mudando por mãos de membros, e o Super admin, único que cria eventos, é quem decide reabrir um.

## Consequences

- A AccessPolicy checa o papel antes do estado: um Viewer que tenta escrever num evento arquivado recebe `403`, não `409`. O `409` sinaliza que o problema é o estado do evento, não a permissão.
- `archive` e `unarchive` são idempotentes: pedir o estado em que o evento já está devolve `200` com ele.
- Toda escrita de membro que venha a existir (Registry, Verification de Contribution, membros, API tokens, emails) herda a regra. Um Pix que chegue depois do arquivamento só é conferido se o Super admin desarquivar o evento.
