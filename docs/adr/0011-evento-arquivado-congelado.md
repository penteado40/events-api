# Evento arquivado fica congelado, e só o Super admin desarquiva

O PRD previa que arquivar um Event recusasse apenas as escritas vindas do Site (`EVENT_ARCHIVED`), deixando os membros editarem normalmente. Decidimos que arquivar **congela o evento para todos**: qualquer escrita de membro (Owner, Manager) ou do Site num evento arquivado é recusada com `409 EVENT_ARCHIVED`, e só o Super admin escreve nele e o desarquiva (`POST /events/:id/unarchive`). Arquivar é encerrar: um evento que acabou não deve continuar mudando por mãos de membros, e o Super admin, único que cria eventos, é quem decide reabrir um.

## Consequences

- A AccessPolicy checa o papel antes do estado: um Viewer que tenta escrever num evento arquivado recebe `403`, não `409`. O `409` sinaliza que o problema é o estado do evento, não a permissão.
- `archive` e `unarchive` são idempotentes: pedir o estado em que o evento já está devolve `200` com ele.
- Toda escrita de membro que venha a existir (Registry, Verification de Contribution, membros, API tokens, emails) herda a regra, salvo a Verification do Owner (ver o refinamento abaixo).

## Refinamento: o que cada membro vê de um evento arquivado

Arquivar também reduz o que se **vê**, não só o que se escreve. Os Owners continuam vendo tudo em modo leitura, porque quem responde pelo evento precisa do histórico (agradecer quem confirmou presença, conferir quem contribuiu). Managers e Viewers veem só o **Event summary**: números agregados, sem dado de nenhum Guest. Depois do evento, os dados pessoais dos convidados ficam restritos a quem já os tinha por inteiro.

A mesma regra resolve o Pending user cujos eventos foram todos arquivados: ele ainda ativa a conta e entra, mas só vê o resumo. Não há recusa na ativação nem desativação automática. Cada módulo que guarda dado de Guest (RSVP, Registry, Contribution) define o seu pedaço do Event summary quando for construído.

## Refinamento: o Site continua lendo, e o Owner ainda revoga API tokens

Congelar é sobre **mudanças**, não sobre tirar o evento da internet. As leituras públicas do Site (com um API token ativo) continuam respondendo num evento arquivado; só as escritas públicas (RSVP, Contribution) recebem `EVENT_ARCHIVED`. Para o Site mostrar "evento encerrado" sem esperar um `409`, a leitura pública traz o `status` do evento.

A exceção à regra do congelamento: o Owner ainda pode **desativar** e **apagar** API tokens de um evento arquivado. Revogar uma credencial vazada é segurança e não pode depender do Super admin; e só fecha acesso, sem tocar em nenhum dado que o congelamento protege. É o mesmo raciocínio de `archive` sobre um evento já arquivado: não é o tipo de escrita que o congelamento recusa. Criar, renomear, mudar Scopes e reativar continuam congelados (`EVENT_ARCHIVED`).

## Refinamento: o Owner ainda faz a Verification

O texto original dizia que um Pix chegado depois do arquivamento só seria conferido se o Super admin desarquivasse o evento. Decidimos que o **Owner** ainda faz a Verification (`verify` / `reject`) de uma Paid contribution num evento arquivado. Managers e Viewers não: o Manager recebe `409 EVENT_ARCHIVED` e o Viewer, `403` (papel antes do estado). A Verification não muda o evento, só registra se um Pix que o Guest já declarou ter pago chegou mesmo, e é justamente o "conferir quem contribuiu" que o refinamento de leitura deixa nas mãos do Owner. Obrigar o Super admin a desarquivar só para isso reabriria o evento inteiro para escritas que o congelamento existe para impedir.
