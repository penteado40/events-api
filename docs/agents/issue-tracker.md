# Issue tracker: Jira

As tarefas deste repo vivem no Jira. Use as ferramentas do Atlassian (MCP `Atlassian Rovo`) para todas as operações.

- Site: `flpenteado.atlassian.net`
- Projeto: `PROJ`
- Épico: **PROJ-51 "Events-API"**. Todas as tarefas do events-api são filhas dele.
- Labels: `v1` / `v2` (fase) e `github-N` (número da issue original no GitHub, de onde as tarefas foram migradas).
- O PRD continua na issue [#1 do GitHub](https://github.com/penteado40/events-api/issues/1) (`gh issue view 1`).

## Convenções

- **Listar tarefas**: JQL `parent = PROJ-51 ORDER BY key ASC`, com filtro por `labels = v1` e `status`.
- **Ler uma tarefa**: busque a issue pela chave (ex.: `PROJ-52`) com `description` e `comment`. A busca por JQL não traz a descrição completa; leia a issue individualmente.
- **Dependências**: links do tipo "Blocks" ("is blocked by"). A primeira tarefa disponível é a de menor chave, na fase `v1`, sem bloqueios em aberto.
- **Criar uma tarefa**: tipo `História` (funcionalidade) ou `Tarefa` (operacional), com o épico PROJ-51 como pai.
- **Comentar / transicionar**: adicione um comentário na issue e use as transições do fluxo do projeto.

## Quando uma skill disser "publish to the issue tracker"

Crie uma issue no projeto `PROJ`, filha do épico PROJ-51.

## Quando uma skill disser "fetch the relevant ticket"

Busque a issue do Jira pela chave, incluindo os comentários.

## Wayfinding operations

O épico **PROJ-51** é também o mapa wayfinder do pivô para Groups (label `wayfinder:map`). A descrição dele traz Destination, Notes, Decisions so far, Not yet specified e Out of scope.

- **Ticket do mapa**: filho do PROJ-51 com label `v2` e `wayfinder:<tipo>` (`grilling`, `research`, `prototype`, `task`). O corpo é a seção `## Question`.
- **Bloqueio**: links nativos "Blocks" ("is blocked by").
- **Fronteira**: JQL `parent = PROJ-51 AND labels in ("wayfinder:grilling", "wayfinder:research", "wayfinder:prototype", "wayfinder:task") AND statusCategory != Done AND assignee is EMPTY ORDER BY key ASC`, descartando os que ainda têm um bloqueio aberto.
- **Reivindicar**: atribuir o ticket a quem conduz o mapa, antes de qualquer trabalho.
- **Resolver**: comentário de resolução, transição para Concluído e uma linha em "Decisions so far" na descrição do PROJ-51.
- **Fora de escopo**: fechar o ticket e registrar uma linha em "Out of scope" no mapa.
