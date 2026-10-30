---
status: superseded by ADR-0017
---

# Papéis de membro com um dono principal por evento

> Substituído pelo ADR-0017 (2026-10-02): os papéis passaram para o Group, os Owners são iguais e só o Super admin dá, tira ou rebaixa Owner. Não há Primary owner.

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

## Refinamentos (PROJ-56)

- **Todo Event que ganha um Primary owner nunca mais fica sem um.** Só um Event criado sem Primary owner fica nesse estado, até o Super admin definir um. O Super admin segue a mesma regra dos demais: para tirar ou rebaixar o Primary owner, ele primeiro transfere o posto (pelo mesmo endpoint de transferência), mesmo em caso de conflito. Preferimos não correr o risco de deixar um Event sem responsável.
- **O posto só vai para quem já é Owner.** Promover e transferir são dois atos separados, então quem entra no controle total entra de forma explícita.
- **Ao adicionar um Event member, o papel é obrigatório**, e qualquer Owner pode adicionar alguém direto como Owner.
- **Qualquer membro sai do Event por conta própria**, inclusive Manager e Viewer: sair não é gerenciar membros. O Primary owner é a exceção e precisa transferir o posto antes.
- **Um User e o Activation link dele são da plataforma, não do vínculo.** Adicionar um User a um Event nunca mexe nele: só um User recém-criado recebe link. Quando um Pending user perde o último vínculo, o link dele é invalidado, para não sobrar uma credencial solta, por exemplo quando alguém foi adicionado com o email errado.
