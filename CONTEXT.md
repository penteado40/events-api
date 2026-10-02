# events-api

Plataforma de programação para grupos artísticos: a produção monta cada Event (ensaios, gravações, viagens com atividades e deslocamentos) e cada integrante vê a própria programação. Substituiu, antes de entrar em produção, o desenho anterior de sites de eventos com convidados (RSVP, lista de presentes), que continua na `fawedding-api`.

## Grupos e eventos

**Group** (grupo):
A unidade de tenant da plataforma: um grupo artístico (ex.: o Vocal Livre) com os seus integrantes e a sua produção. Todo Event pertence a exatamente um Group.
_Avoid_: banda, companhia, coral (são tipos de Group), tenant, organização

**Event** (evento):
Qualquer compromisso de um Group, de um ensaio de uma tarde a uma viagem de vários dias. Tem só onde (uma cidade ou um local, com o fuso padrão) e quando (o período); todo o resto é Event item. Uma viagem é só um Event com deslocamentos.
_Avoid_: Trip, viagem (como conceito separado), agenda (lembra calendário), compromisso, turnê

**Event item** (item do evento):
Cada peça da programação de um Event: um acontecimento com hora (uma apresentação, uma saída, um voo, um almoço) ou uma orientação sem hora (o que levar, contato da produção, voltagem). A hora é sempre a do lugar onde ele acontece, nunca convertida para onde a pessoa está.
_Avoid_: Activity, atividade, apresentação, show (são tipos de Event item), Appearance, item do roteiro

**Saved place** (lugar salvo):
Um lugar que um Group usa com frequência (a sede, o ponto de saída, um aeroporto), com nome, endereço e fuso. Escolhê-lo num Event item só copia esses dados: editar o Saved place depois não muda nenhum Event item.
_Avoid_: Venue, local (é o que o Event item guarda), endereço

**Field** (campo):
Uma informação livre dentro de um Event item, com um nome e um valor: texto, pessoas ou fotos (ex.: "Obs: despachar som", "Carro 1 - EC: Matias, Jacque", a paleta de roupa).
_Avoid_: atributo, propriedade, bloco

**Personal note** (nota individual):
O valor de uma pessoa dentro de um Field de pessoas (ex.: o localizador dela, "dirigindo"). Por padrão só ela e a produção veem; o Field pode torná-las visíveis para todos.
_Avoid_: observação (é um Field de texto), comentário

**Audience** (público):
Quem um Event item alcança. Uma pessoa só vê os Event items cujo Audience a inclui.
_Avoid_: quem, destinatários, participantes (do item)

**Highlight** (destaque):
A marca num Field que o leva para o Summary. Independe da hora do Event item.
_Avoid_: favorito, fixado, importante

**Summary** (resumo):
A visão rápida de um Event para uma pessoa: um cartão por Event item que tenha algum Field com Highlight, mostrando só esses Fields.
_Avoid_: dashboard, visão geral

**Timeline** (linha do tempo):
Os Event items com hora de um Event, em ordem, como a pessoa os vê. Os Event items sem hora são as orientações.
_Avoid_: ordem do dia, cronograma, roteiro

## Pessoas

**User** (usuário):
Uma pessoa com login na plataforma, única por email e independente de quantos Groups ela participa. Nasce pelas mãos do Super admin ou implicitamente quando um Owner adiciona como Group member um email que ainda não tem User; não há cadastro aberto.
_Avoid_: conta, cliente, admin

**Pending user** (usuário pendente):
Um User que ainda não definiu a própria senha e por isso não consegue fazer login. Ninguém além dele define a senha de um User.
_Avoid_: usuário inativo, desativado, convidado

**Activation link** (link de ativação):
Link de uso único pelo qual um Pending user define a própria senha e passa a poder fazer login. Quem cria o User o entrega à pessoa.
_Avoid_: convite, link de setup, senha inicial

**Deactivated user** (usuário desativado):
Um User retirado da plataforma: não faz mais login, mas continua existindo, e tudo o que ele criou ou editou permanece intacto e atribuído a ele. Um User nunca é apagado.
_Avoid_: usuário excluído, deletado, removido

**Author** (autor):
O User que criou ou editou por último um registro. Escritas que não partem de um User (scripts da plataforma, processos automáticos) não têm Author.
_Avoid_: dono do registro, owner (Owner é papel), responsável

**Super admin**:
O papel de plataforma com acesso total a todos os Groups e o único que cria Groups. Concedido só pela configuração da plataforma, nunca pela API. Nunca é Group member: o acesso dele vem do papel, não de vínculos.
_Avoid_: root, admin geral

**Group member** (membro do grupo):
O vínculo entre um User e um Group, com um papel: Owner ou Viewer. Um User pode ser Group member de vários Groups (ex.: uma produtora que atende vários grupos).
_Avoid_: integrante (quando se refere ao vínculo), colaborador

**Owner**:
Group member que responde pelo Group: edita o Group, os membros, os Events e os Event items. É a produção.
_Avoid_: dono (sem qualificador), admin do grupo, produtor

**Viewer**:
Group member que só consulta: vê os Events do Group, cada um filtrado pelos Audiences.
_Avoid_: leitor, participante, convidado

**Event manager**:
O vínculo entre um User e um único Event, que deixa editar os Event items daquele Event e nada mais (ex.: um produtor local de Manaus). Não é Group member.
_Avoid_: Manager (sem qualificador), organizador, gerente, editor

**Membership** (vínculo):
Os vínculos de quem está fazendo a requisição, vistos a partir dele: o papel no Group e os Events de que é Event manager. O Super admin não tem Membership.
_Avoid_: viewer (Viewer é um papel), papel do usuário, acesso

## Emails

**Email kind** (tipo de email):
O motivo de um email para um Guest (hoje só a confirmação de RSVP). Cada kind tem textos padrão por Event type e idioma.
_Avoid_: template (template é a forma, kind é o motivo)

**Email log**:
O registro de cada tentativa de envio de email, com status e erro.
_Avoid_: histórico de email, fila

**Platform sender** (remetente da plataforma):
O endereço de envio único da plataforma, usado por todos os Groups.
_Avoid_: noreply do grupo
