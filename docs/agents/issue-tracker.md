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
