# events-api

Plataforma multi-evento que sustenta sites de eventos (casamentos, aniversários, eventos corporativos, chás...): confirmação de presença, lista de presentes com contribuições via Pix e emails para convidados. Sucessora da `fawedding-api`, que atendia só casamentos.

## Evento e pessoas

**Event** (evento):
A unidade de tenant da plataforma: um acontecimento com tipo, data/hora de início, local e site próprio. Todo dado de convidado, presente e token pertence a exatamente um Event.
_Avoid_: Wedding, casamento (é só um tipo de Event), tenant, festa

**Event type** (tipo de evento):
A categoria de um Event (`WEDDING`, `BIRTHDAY`, `CORPORATE`, `BABY_SHOWER`, `PARTY`, `OTHER`). Define os textos padrão dos emails; não liga nem desliga funcionalidades.
_Avoid_: categoria, modalidade

**Slug**:
O identificador legível e permanente de um Event, único na plataforma e definido pelo Super admin na criação. Nunca muda.
_Avoid_: apelido, handle, código do evento

**Archived event** (evento arquivado):
Um Event encerrado e congelado: continua visível para os membros, mas não aceita mais nenhuma escrita, nem do Site nem dos membros. Só o Super admin escreve nele e só ele o desarquiva, devolvendo-o a ativo.
_Avoid_: evento finalizado, inativo, deletado

**User** (usuário):
Uma pessoa com login na plataforma, única por email e independente de quantos Events ela participa. Nasce pelas mãos do Super admin ou implicitamente quando um Owner adiciona como Event member um email que ainda não tem User; não há cadastro aberto.
_Avoid_: conta, cliente, admin

**Pending user** (usuário pendente):
Um User que ainda não definiu a própria senha e por isso não consegue fazer login. Ninguém além dele define a senha de um User.
_Avoid_: usuário inativo, desativado, convidado

**Activation link** (link de ativação):
Link de uso único pelo qual um Pending user define a própria senha e passa a poder fazer login. Quem cria o User o entrega à pessoa.
_Avoid_: convite, link de setup, senha inicial

**Super admin**:
O papel de plataforma com acesso total a todos os Events e o único que cria Events. Concedido só pela configuração da plataforma, nunca pela API. Nunca é Event member: o acesso dele vem do papel, não de vínculos.
_Avoid_: root, admin geral

**Event member** (membro do evento):
O vínculo entre um User e um Event, com um papel: Owner, Manager ou Viewer.
_Avoid_: gerente, manager (quando se refere ao vínculo em geral), colaborador

**Owner**:
Membro com controle total do Event, incluindo membros e API tokens. Um Owner que não é o Primary owner é chamado de Owner organizador.
_Avoid_: dono (sem qualificador), admin do evento

**Primary owner** (dono principal):
O único Owner que responde pelo Event: só ele rebaixa ou remove outros Owners e transfere o próprio posto. No máximo um por Event.
_Avoid_: owner admin, owner_admin, dono real, criador

**Manager**:
Membro que opera o dia a dia do Event (convidados, presentes, conferência de contribuições, dados do evento e emails), sem gerenciar membros nem tokens.
_Avoid_: organizador, gerente

**Viewer**:
Membro que só consulta o Event.
_Avoid_: leitor, convidado (convidado é quem vai ao evento)

**Guest** (convidado):
Pessoa que interage com o site público do Event: confirma presença ou contribui com um presente. Não tem login.
_Avoid_: usuário, visitante

## Acesso público

**Site**:
O frontend público de um Event, identificado pelo `siteUrl`.
_Avoid_: landing, front do casal

**API token**:
Credencial de um Site para falar com a API em nome de um único Event, limitada por Scopes.
_Avoid_: chave pública, token do front, secret

**Scope** (escopo):
Uma permissão pontual concedida a um API token (ex.: criar RSVP, ler a Registry).
_Avoid_: permissão (genérico), role

## Presença

**RSVP**:
A resposta de um Guest sobre a presença em um Event, única por email dentro do Event.
_Avoid_: confirmação, inscrição, presença

## Presentes e contribuições

**Registry** (lista de presentes):
O conjunto de Registry items de um Event.
_Avoid_: wishlist, gift list, lista de desejos

**Registry item** (presente):
Um item da Registry com nome, descrição, imagem e preço de referência.
_Avoid_: gift, produto

**Contribution** (contribuição):
Uma tentativa de um Guest de pagar um Registry item via Pix, do momento em que o QR code é gerado até a Verification.
_Avoid_: gift payment, pagamento, transação, doação

**Contribution token**:
Chave de uso único entregue ao Guest quando uma Contribution é aberta; só quem a possui pode abandonar ou marcar como paga aquela Contribution.
_Avoid_: API token (é outra coisa), código da transação

**Abandoned contribution** (contribuição abandonada):
Contribution que o Guest fechou ou refez antes de dizer que pagou.
_Avoid_: cancelada

**Paid contribution** (contribuição paga):
Contribution que o Guest declarou ter pago. É uma declaração, não uma prova.
_Avoid_: confirmada, concluída

**Verification** (conferência):
O ato de um membro checar se o Pix de uma Paid contribution chegou, resultando em Verified ou Rejected.
_Avoid_: confirmação, aprovação

**Receipt** (comprovante):
Arquivo opcional (foto ou PDF) que o Guest anexa ao marcar uma Contribution como paga. É dado privado, visível só para membros.
_Avoid_: recibo, nota, anexo

## Emails

**Email kind** (tipo de email):
O motivo de um email para um Guest (hoje só a confirmação de RSVP). Cada kind tem textos padrão por Event type e idioma.
_Avoid_: template (template é a forma, kind é o motivo)

**Email log**:
O registro de cada tentativa de envio de email, com status e erro.
_Avoid_: histórico de email, fila

**Platform sender** (remetente da plataforma):
O endereço de envio único da plataforma, usado por todos os Events que não têm domínio próprio verificado.
_Avoid_: noreply do casal, remetente do site
