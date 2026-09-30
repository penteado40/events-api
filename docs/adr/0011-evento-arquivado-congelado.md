# Evento arquivado fica congelado, e só o Super admin desarquiva

O PRD previa que arquivar um Event recusasse apenas as escritas vindas do Site (`EVENT_ARCHIVED`), deixando os membros editarem normalmente. Decidimos que arquivar **congela o evento para todos**: qualquer escrita de membro (Owner, Manager) ou do Site num evento arquivado é recusada com `409 EVENT_ARCHIVED`, e só o Super admin escreve nele e o desarquiva (`POST /events/:id/unarchive`). Arquivar é encerrar: um evento que acabou não deve continuar mudando por mãos de membros, e o Super admin, único que cria eventos, é quem decide reabrir um.

## Consequences

- A AccessPolicy checa o papel antes do estado: um Viewer que tenta escrever num evento arquivado recebe `403`, não `409`. O `409` sinaliza que o problema é o estado do evento, não a permissão.
- `archive` e `unarchive` são idempotentes: pedir o estado em que o evento já está devolve `200` com ele.
- Toda escrita de membro que venha a existir (Registry, Verification de Contribution, membros, API tokens, emails) herda a regra. Um Pix que chegue depois do arquivamento só é conferido se o Super admin desarquivar o evento.

## Refinamento: o que cada membro vê de um evento arquivado

Arquivar também reduz o que se **vê**, não só o que se escreve. Os Owners continuam vendo tudo em modo leitura, porque quem responde pelo evento precisa do histórico (agradecer quem confirmou presença, conferir quem contribuiu). Managers e Viewers veem só o **Event summary**: números agregados, sem dado de nenhum Guest. Depois do evento, os dados pessoais dos convidados ficam restritos a quem já os tinha por inteiro.

A mesma regra resolve o Pending user cujos eventos foram todos arquivados: ele ainda ativa a conta e entra, mas só vê o resumo. Não há recusa na ativação nem desativação automática. Cada módulo que guarda dado de Guest (RSVP, Registry, Contribution) define o seu pedaço do Event summary quando for construído.
