# Pivô para programação de Groups, com Event items de Fields livres

A events-api nasceu para substituir a `fawedding-api` (sites de eventos com Guests, RSVP, lista de presentes e Contribution). Antes de entrar em produção, decidimos trocar o produto: a API passa a ser a **programação de grupos artísticos** (caso real: o Vocal Livre, cuja produção manda um PDF por viagem). A demanda esperada por sites de casamento e aniversário é pequena, e a `fawedding-api` continua servindo os eventos antigos, então não há migração nem convivência entre os dois modelos. O `identity` (User, Activation link, login) fica; o conceito antigo de Event e tudo o que dependia de Guest saem.

O **Group** é o tenant. O **Event** passa a ser qualquer compromisso de um Group, de um ensaio de uma tarde a uma viagem de vários dias, e guarda só onde (cidade ou local, com fuso padrão) e quando (o período). Todo o resto é **Event item**: uma peça da programação com hora (entra na Timeline) ou sem hora (uma orientação), cujo conteúdo são **Fields livres**, cada um com nome escolhido pela produção e valor de um único tipo: texto, pessoas ou fotos. Quem vê cada Event item é o Audience dele. O que vai para a visão rápida é o Highlight de cada Field. Os termos estão no `CONTEXT.md`.

## Considered Options

- **Tipos estruturados de Event item** (Flight, Ticket, Car, Hotel, com campos e regras próprios, como liberar o carro ou cobrar a passagem pendente). Descartado: cada viagem do PDF tem um formato diferente, e a produção precisaria esperar um tipo novo para cada caso. Com Fields livres, "Carro 1 - EC: Matias, Jacque" e "Voo G3 1234" são só Fields. Ampliar o conjunto de tipos de valor de um Field continua sendo trabalho de desenvolvimento, e o modelo deve aceitar um tipo novo sem migrar os Fields existentes.
- **Trip ou Agenda como conceitos à parte do Event.** Descartado: uma viagem é só um Event com deslocamentos, e um conceito a mais duplicaria Participants, Audiences e o ciclo de vida.
- **Venue como biblioteca referenciada.** Descartado: o local é texto dentro do Event item. O Saved place é só um atalho que copia nome, endereço e fuso, e editá-lo depois não muda nenhum Event item.

## Consequences

- **A hora é sempre a do lugar, nunca convertida.** "Show 19h" em Manaus é 19h para todos, inclusive para quem abre o app em São Paulo. O Event item guarda a hora local junto com o fuso do lugar, e o fuso serve para rotular ("horário de Manaus") e ordenar. Isso emenda o ADR-0008, que mandava datas em ISO 8601 UTC.
- Substitui os ADRs que só existiam por causa dos Sites e dos Guests: 0001 (migração da `fawedding-api`), 0002 (ids preservados), 0004 (Contribution token), 0005 (Receipt) e 0015 (RSVP). Substitui também o 0011: o congelamento do evento arquivado protegia os dados dos Guests depois do evento. O Archived event agora só tira o Event de vista de quem não é Owner, sem congelá-lo (ver `CONTEXT.md`).
- O papel de cada pessoa muda: os papéis do Group estão no ADR-0017, e quem vai junto sem ser do Group entra pelo Guest access link (ADR-0018).
- As fotos dos Fields reaproveitam o desenho do ADR-0005: Cloudinary `authenticated`, URL assinada de curta duração e upload direto com parâmetros assinados pela API.
- Os dados e o código do modelo antigo (tabelas `Event`, `EventMember` e `ApiToken`; módulo `events`) saem depois do PRD da V2. O destino do módulo ainda está em aberto no mapa do pivô (PROJ-51).
