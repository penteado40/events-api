# Owners iguais, e só o Super admin dá, tira ou rebaixa Owner

O ADR-0003 criou o Primary owner para que um Event com vários organizadores tivesse um responsável claro, sem que os Owners se removessem entre si. No pivô (ADR-0016), os papéis passam do Event para o Group, e decidimos **não levar o Primary owner junto**: todos os Owners de um Group são iguais, e nenhum deles adiciona, remove ou rebaixa outro Owner. Quem mexe nos Owners é só o Super admin, que já é o único que cria Groups. A proteção que o Primary owner dava (Owners não se derrubam) continua, sem uma hierarquia que precise ser transferida quando a produção muda.

## Regras

- Só o Super admin dá o papel de Owner (adiciona direto ou promove um Viewer) e só ele remove ou rebaixa um Owner.
- Os Owners adicionam e removem Viewers, Event managers e Event guests.
- Um Owner pode sair do Group ou se rebaixar a Viewer, menos o último.
- Um Group pode nascer sem Owner, até o Super admin definir o primeiro. Depois disso nunca mais fica sem, nem pelas mãos do Super admin, que coloca outro antes de tirar o último.
- Viewers, Event managers e Event guests não saem por conta própria: só um Owner (ou o Super admin) os remove.
- Event manager e Event guest valem só durante o Event: da hora em que são adicionados até o fim do Event, mais 7 dias fixos da plataforma só de consulta. Depois perdem o acesso àquele Event.
- Removido ou expirado, o nome fica nos Fields de pessoas (marcado como fora do Event) e nos Finished events.

## Considered Options

- **Levar o Primary owner para o Group** (o ADR-0003 adaptado). Descartado: a hierarquia entre Owners só servia para impedir que eles se removessem entre si, e tirar dos Owners o poder sobre outros Owners resolve isso sem um posto a transferir.
- **"O último Owner não sai" como única trava, com Owners criando e gerenciando Owners.** Descartado: um Owner poderia derrubar os outros da produção, e o Super admin perderia o controle de quem responde por cada Group.
- **Saída voluntária de Viewers**, e uma folga de 30 dias ou configurável por Group para Event managers e Event guests. Descartados: a saída fica com a produção, que sabe quem está escalado, e 7 dias fixos bastam para consultar o que aconteceu.

## Consequences

- O índice único parcial do Primary owner e a regra de transferência do posto saem junto com a tabela `EventMember`.
- "O último Owner não sai" olha para vários vínculos ao mesmo tempo: dois Owners saindo juntos podem deixar o Group sem nenhum. É o gatilho que o ADR-0014 previa para serializar as escritas, e a solução fica para o PRD (ver a emenda do ADR-0014).
- Promover um Viewer a Owner deixa de ser um ato dos Owners e vira uma ação do Super admin, então o painel do Group não oferece esse caminho a eles.
