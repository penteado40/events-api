# RSVP é só confirmação de presença

O RSVP registra quem **vai**. O Site só oferece "confirmar presença": não há resposta "não vou", e um RSVP não tem `status` nem `attending`. Quem não vai simplesmente não deixa RSVP. Para os membros, a lista de RSVPs é a lista de confirmados, e o número que importa é o total dela.

A `fawedding-api` tinha `RsvpStatus { PENDING, CONFIRMED, DECLINED }`, mas só `CONFIRMED` era usado: nenhum registro `PENDING` ou `DECLINED` existe. O status nunca carregou informação, só a promessa de um fluxo de recusa que ninguém construiu.

## Considered Options

- **Guardar a resposta com um status (vai / não vai)**, como o enum da `fawedding-api` sugeria, e os membros filtrarem. Descartamos: obriga o Site a oferecer a recusa, cria dois sentidos para "RSVP" (resposta e confirmação) e um número ("não vão") que, pelo histórico, ninguém alimenta.
- **O Site aceitar a recusa sem guardá-la.** Na prática é a decisão tomada; descartamos só o formulário com "não vou", que daria a entender ao Guest que a resposta fica registrada.

## Consequences

- O modelo nasce sem `status`/`attending`; `GET /events/:id/rsvps` lista todos, sem filtro por status.
- A migração (PROJ-69) copia só os RSVPs `CONFIRMED`, que hoje são todos.
- O app de membros (events-expo) mostra os confirmados e um único número ("Confirmados"), sem o par vão / não vão.
- Se um dia a recusa for pedida (por exemplo, para o casal saber quem avisou que não vai), ela entra como conceito novo com nome próprio, não como um status do RSVP.
