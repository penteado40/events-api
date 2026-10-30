# Ordem de implementação da primeira fatia da V2

Retrato de 2026-10-29 dos bloqueios no Jira (épico PROJ-51, PRD [#57](https://github.com/penteado40/events-api/issues/57)). A fonte da verdade continua sendo os links "is blocked by" no Jira. Se um bloqueio mudar lá, vale o Jira.

Cada onda só depende de tasks de ondas anteriores. Dentro de uma onda, as tasks podem ser feitas em qualquer ordem ou em paralelo. A ordem sugerida para quem trabalha sozinho é a da tabela: onda por onda e, dentro da onda, pela chave.

## Identidade no Clerk

| Onda | Task | O quê | Bloqueada por |
| --- | --- | --- | --- |
| 1 | PROJ-161 | Apagar o módulo `events` da V1 e as tabelas `Event`, `EventMember` e `ApiToken` | — |
| 2 | PROJ-162 | Tirar o `X-Api-Key`, os Scopes e o CORS por siteUrl | 161 |
| 3 | PROJ-163 | Guard por Bearer do Clerk com `AuthVerifier` e vínculo do User pelo email | 162 |
| 4 | PROJ-164 | Remover o login próprio, a troca de senha, o JWT, o bcrypt e a política de senha (e a senha do `create-super-admin`) | 163 |
| 4 | PROJ-165 | Telefone obrigatório no User e edição de nome e telefone pelo `me` | 163 |
| 4 | PROJ-166 | Deactivated user recusado a cada requisição | 163 |
| 4 | PROJ-167 | Webhook do Clerk atualiza o espelho de nome e email do User | 163 |
| 5 | PROJ-80 | `@Inject` explícito nos construtores das classes do Nest | 164 |
| 5 | PROJ-169 | Scalar autenticado pelo Bearer do Clerk, sem `/auth/token` | 164 |
| 5 | PROJ-170 | Activation link como convite do Clerk: Super admin cria User e recebe o link | 165 |

## Groups, emails e Group members

| Onda | Task | O quê | Bloqueada por |
| --- | --- | --- | --- |
| 6 | PROJ-168 | Super admin cria e lista Groups | 80, 163 |
| 6 | PROJ-171 | Módulo `emails` com o email Activation link da conta e o Email log | 170 |
| 7 | PROJ-172 | Super admin define um Owner do Group pelo email | 168, 170 |
| 7 | PROJ-173 | Novo Activation link revoga o anterior | 171 |
| 7 | PROJ-176 | Verificação manual contra o Clerk real: email do convite, idioma e deep link (**humano**) | 171 |
| 8 | PROJ-174 | Emails de Group: Activation link de Group e Group access, com remetente do Group e `replyTo` | 171, 172 |
| 8 | PROJ-175 | Regra do último Owner com escritas de Group members serializadas | 172 |
| 9 | PROJ-177 | Owner adiciona Viewer ao Group pelo email | 174, 175 |
| 10 | PROJ-178 | Lista de Group members com telefone e Membership no `me` | 177 |
| 10 | PROJ-179 | Owner remove Viewer do Group e publica `GroupMemberRemoved` (nasce a infra de domain events) | 177 |
| 10 | PROJ-180 | Owner gera novo Activation link para um Viewer pendente | 173, 177 |
| 10 | PROJ-181 | Owner cria, renomeia, lista e apaga Teams | 177 |

## Events, Participants e Event items

| Onda | Task | O quê | Bloqueada por |
| --- | --- | --- | --- |
| 10 | PROJ-182 | Event em Draft: criar, editar e listar com onde e quando em hora local | 177 |
| 11 | PROJ-183 | Membros de Team; quem sai do Group sai dos Teams | 179, 181 |
| 11 | PROJ-184 | Changes do Event gravadas na mesma transação | 175, 182 |
| 12 | PROJ-185 | Publicar o Event | 184 |
| 12 | PROJ-186 | Participants nascem como cópia dos Group members | 184 |
| 12 | PROJ-187 | Criar Event item com data, hora local e lugar; Owner lê a General info e a Timeline | 184 |
| 13 | PROJ-188 | Cancelar e descancelar o Event, congelado enquanto cancelado | 185 |
| 13 | PROJ-189 | Participants nascem de Teams | 183, 186 |
| 13 | PROJ-190 | Ajustar Participants, com Changes que só a produção vê | 186 |
| 13 | PROJ-191 | Changes dos Event items | 187 |
| 14 | PROJ-192 | Quem sai do Group deixa de ser Participant dos Events que ainda não acabaram | 179, 190 |
| 14 | PROJ-193 | Ordem manual dos Event items onde a hora não decide | 191 |
| 14 | PROJ-194 | Draft do Event item: nasce em Draft num Event publicado, publicar e apagar | 185, 191 |
| 15 | PROJ-195 | Cancelar e descancelar o Event item | 188, 194 |

## Programação do Viewer, Audience, Fields e Last seen

| Onda | Task | O quê | Bloqueada por |
| --- | --- | --- | --- |
| 15 | PROJ-196 | Viewer lê a própria programação com Audience "Todos" (regra de alcance) | 186, 194 |
| 16 | PROJ-197 | Audience escolhido com Participants avulsos | 190, 196 |
| 16 | PROJ-198 | Field de texto: criar, editar, apagar e ordenar | 196 |
| 17 | PROJ-199 | Audience montado a partir de Teams | 183, 197 |
| 17 | PROJ-200 | Highlight nos Fields e Summary | 198 |
| 17 | PROJ-201 | Field de pessoas com Users, que entram no Audience pelo Field | 198 |
| 17 | PROJ-202 | Last seen: riscado no card, `seenUpTo` e rota de marcar | 198 |
| 18 | PROJ-203 | Nome solto num Field de pessoas | 201 |
| 18 | PROJ-204 | Personal note com a visibilidade escolhida no Field | 201 |
| 18 | PROJ-205 | Quem saiu do Event aparece marcado como fora nos Fields de pessoas | 190, 201 |
| 18 | PROJ-206 | Telefone das pessoas na leitura da programação | 178, 201 |
| 18 | PROJ-207 | Last seen: selo de novo e item fantasma | 197, 202 |
| 19 | PROJ-208 | Vincular um nome solto a um User em todo o Event | 203 |
| 19 | PROJ-209 | Last seen: item que estava em Draft aparece só como novo | 194, 207 |

## Caminho crítico

A cadeia mais longa tem 19 ondas: 161 → 162 → 163 → 164 → 80 → 168 → 172 → 175 → 177 → 182 → 184 → 187 → 191 → 194 → 196 → 198 → 202 → 207 → 209. Atrasar qualquer task dessa cadeia atrasa a fatia inteira. As demais têm folga e podem ser encaixadas entre elas.

## Pontos de atenção

- **PROJ-164** tem uma decisão a tomar no início: como o primeiro Super admin entra no Clerk, que só aceita quem foi convidado (recomendação: convite pelo dashboard do Clerk).
- **PROJ-80** fica entre a 164 e a 168 para que os módulos `groups` e `events` já nasçam com `@Inject` e a skill `new-use-case` ensine a regra nova.
- **PROJ-176** é verificação manual contra o Clerk real e não pode ser feita por agente.
- **Fora da fatia, antes de ir para produção:** PROJ-82 (o filtro de erros não pode vazar dados pessoais dos argumentos do Prisma).
- **Depois da fatia:** PROJ-99 (rota de desativação), PROJ-79 (paginação), PROJ-158 (pacote de contratos com o events-expo, a decidir antes do PRD das telas do app).
- **A conferir:** os pontos em aberto da PROJ-160 (o Owner ver a programação "como" um Participant, a mudança de Audience ser uma Change só da produção, e as emendas dos ADRs 0014 e 0008).
