# Identidade no Clerk atrás de uma porta

O events-api tinha autenticação própria (login, bcrypt, JWT, Activation link com definição de senha, troca de senha, política de senha e rate limit do login), testada e funcionando. Para a primeira fatia da V2, decidimos entregar a identidade ao **Clerk** (plano Hobby), pelo login com Google e Apple, por não manter senhas e por ter os convites prontos. A verificação fica atrás da porta **`AuthVerifier`** no `application` (`verify(token) → { externalId, email }`, com o email verificado que o vínculo usa), com um adaptador Clerk (`verifyToken` do `@clerk/backend`) e um falso para os testes de integração. O resto do código continua conhecendo só o User local.

## Regras

- O User continua local, com o `id` inteiro (ADR-0002), mais o `clerkId`. Telefone obrigatório, papel de Super admin e Deactivated user moram no nosso banco. O guard recusa o Deactivated user a cada requisição, sem depender do "banir" do Clerk, que é do plano pago.
- O Activation link é um convite do Clerk criado com `notify: false`: o e-mail sai por nós (Resend, remetente "<Group> via <Plataforma>", Email log), e o link volta para quem o gerou, como decidido no PROJ-118. Não há cadastro aberto (o Clerk exige convite).
- A primeira entrada é sempre com o e-mail do convite, por senha, Google ou Apple. Uma conta de outro e-mail é recusada. Se o Clerk não recusar sozinho, o `identity` recusa ao vincular.
- O vínculo entre o usuário do Clerk e o User local nasce num lugar só: o upsert preguiçoso na primeira requisição autenticada. O webhook (`svix`) só mantém o espelho (nome, e-mail) atualizado e não cria vínculos com Groups.
- O reset de senha e o aviso de senha definida são e-mails do Clerk, com a marca dele enquanto o plano for o Hobby.

## Considered Options

- **Manter a autenticação própria.** Descartado: o reset de senha, o aviso de senha definida e o login social ainda estavam por construir, e manter senhas é um custo permanente. Perde-se a autenticação feita à mão como peça de portfólio, que o git preserva.
- **Própria agora, com a porta, e o Clerk depois.** Descartado: a porta sem um segundo adaptador é abstração especulativa, e a migração de usuários depois de ir para produção é mais cara do que agora, sem dados.
- **Deixar o Clerk mandar o e-mail do convite.** Descartado: no Hobby, os e-mails do Clerk saem com a marca e o texto dele, e o link não voltaria a quem convidou para repassar no WhatsApp.
- **Plano Pro desde já.** Adiado: tira a marca dos e-mails do Clerk e libera o "banir", sem mudar código. Entra quando a marca incomodar.

## Consequences

- O ADR-0012 (política de senha) fica substituído: quem define a regra de senha é o Clerk.
- Saem do `identity` o login, a troca de senha, o bcrypt, o emissor de JWT, a política de senha e o rate limit do login. O app (events-expo) passa a usar o `ClerkProvider` e precisa aceitar o convite por deep link.
- Os usuários passam a depender do Clerk. Trocar de provedor depois exige migrar contas, mas a porta limita a mudança de código ao adaptador e ao guard.
- Não verificados, ficam como critério de aceite: a recusa de conta social com outro e-mail no convite e o idioma dos e-mails do Clerk no Hobby.
