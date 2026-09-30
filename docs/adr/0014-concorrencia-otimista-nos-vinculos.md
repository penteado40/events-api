# Escritas concorrentes em Event members: concorrência otimista, não serialização

Os use cases de membros leem o vínculo, checam o MembershipRules e só depois gravam. Duas escritas simultâneas podiam então sobrescrever uma à outra em silêncio (um rebaixamento desfeito por uma transferência) ou esbarrar no índice do Primary owner e virar `500`. Decidimos pela **concorrência otimista**: o repositório só grava se a linha ainda estiver como foi lida (`WHERE role = <lido> AND "isPrimaryOwner" = <lido>`). Se nada casar, ou se o banco recusar por unicidade ou por linha sumida, a transação é desfeita e a resposta é `409 MEMBER_CHANGED`, e o painel recarrega e tenta de novo. Num Event o normal são dois ou três organizadores, então o conflito é raro. Quando acontecer, precisa ser um erro claro, nunca uma escrita perdida.

## Considered Options

- **Serializar as escritas por Event** (o caminho mais robusto, anotado para o futuro). Toda escrita de membro abriria uma transação que trava a linha do Event (`SELECT … FOR UPDATE`) e **relê** o estado antes de checar as regras. Assim, nenhuma decisão do MembershipRules usa um dado velho, e o conflito vira espera em vez de `409`. Não fizemos agora porque exige uma unidade de trabalho transacional que atravesse os use cases: um port de transação na application, com repositórios que aceitem o contexto da transação. É uma mudança de arquitetura maior do que o problema pede hoje. Os sinais para migrar: conflitos `409 MEMBER_CHANGED` aparecendo com frequência nos logs, ou uma regra que dependa do estado de **vários** vínculos ao mesmo tempo (por exemplo, "no máximo N Owners"), que a checagem linha a linha não protege.
- **Só traduzir os erros do banco** (P2002 e P2025 viram `409`), aceitando a sobrescrita silenciosa. Descartamos porque deixava passar justamente o caso que desfaz uma decisão já confirmada ao usuário.

## Consequences

- O MembershipRules continua decidindo sobre o que foi lido. A proteção está em a gravação falhar se esse estado mudou no meio, não em reler o estado.
- Regras que olham para mais de uma linha não ficam protegidas por essa checagem. Quando surgir a primeira, ela é o gatilho para a serialização descrita acima.
- **O vínculo e o Activation link do Pending user não são atômicos**, porque `identity` e `events` gravam em transações separadas. Ao adicionar, se o vínculo falhar depois do Pending user ter sido criado, o use case compensa derrubando o link, para não sobrar credencial solta. Ao remover, aceitamos uma corrida: se o mesmo Pending user for vinculado a outro Event entre a remoção e a contagem de vínculos, o link dele cai, e um Owner o reemite. A serialização descrita acima, com uma transação que atravesse os contextos, resolveria os dois casos.
