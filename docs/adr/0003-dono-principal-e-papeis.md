# Papéis de membro com um dono principal por evento

Todo membro de um Event tem um papel (`OWNER`, `MANAGER`, `VIEWER`), e no máximo um Owner é o **Primary owner** (`EventMember.isPrimaryOwner`, garantido por índice único parcial criado via SQL na migration, já que o Prisma não gera esse tipo de índice). A plataforma tem só dois papéis globais: `SUPER_ADMIN` e `USER`. Só o Super admin cria Users e Events; não há cadastro aberto.

Escolhemos o dono principal em vez da regra "o último Owner não pode sair" para que um evento com vários organizadores (casal, família) tenha sempre um responsável claro, sem que Owners se removam entre si.

## Regras

- Owners gerenciam membros apenas no próprio Event e nunca alteram Users `SUPER_ADMIN`.
- Qualquer Owner promove membros a Owner e gerencia Managers e Viewers.
- Só o Primary owner (ou o Super admin) rebaixa ou remove outros Owners e transfere o posto de Primary owner para outro Owner.
- Um Owner organizador pode se rebaixar ou sair do evento, mas ninguém promove a si mesmo.
- O Primary owner não sai do evento sem antes transferir o posto.
- Um Event pode ficar sem Primary owner apenas até o Super admin definir um (ex.: logo após a criação).
- Managers editam o evento, os presentes, a configuração de email e fazem a Verification; só Owners gerenciam membros, API tokens e arquivam o evento.
