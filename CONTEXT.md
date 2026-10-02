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

**Draft** (rascunho):
Um Event ou Event item que a produção ainda não liberou. Um Event nasce em Draft: todo Group member já vê onde e quando, mas nenhum Event item dele aparece. Um Event item em Draft só os Owners e o Item lead dele veem, mesmo num Event publicado. Num Event em Draft, o Event item nasce publicado; num Event publicado, nasce em Draft. Publicar e voltar ao Draft vale nos dois sentidos.
_Avoid_: oculto, privado, pendente

**Cancelled** (cancelado):
Um Event ou Event item que não vai mais acontecer, mas continua visível com o selo de cancelado e congelado até a produção descancelá-lo, o que o devolve ao estado anterior. Um Event pode ser cancelado em Draft (a data dele já era visível); um Event item, só depois de publicado (um Draft que não vai acontecer é apagado). Ocupar a data com outro compromisso é criar um Event novo, e o cancelado fica ao lado.
_Avoid_: excluído, removido, adiado

**Finished event** (evento finalizado):
Um Event cujo período já terminou. Não é um estado que alguém muda: nada acontece com ele, e ele continua visível e editável (ex.: subir as fotos do show depois da viagem).
_Avoid_: encerrado, concluído, arquivado

**Archived event** (evento arquivado):
Um Event finalizado ou Cancelled que um Owner tirou de vista: só os Owners o veem, editam e desarquivam; Viewers, Event managers e Event guests deixam de vê-lo. Não muda o estado do Event nem o congela. Um Event futuro e ativo não pode ser arquivado: ele é editado ou cancelado.
_Avoid_: congelado, encerrado, finalizado

**Saved place** (lugar salvo):
Um lugar que um Group usa com frequência (a sede, o ponto de saída, um aeroporto), com nome, endereço e fuso. Escolhê-lo num Event item só copia esses dados: editar o Saved place depois não muda nenhum Event item.
_Avoid_: Venue, local (é o que o Event item guarda), endereço

**Field** (campo):
Uma informação livre dentro de um Event item, com um nome e um valor de um único tipo: texto, pessoas ou fotos (ex.: "Obs: despachar som", "Carro 1 - EC: Matias, Jacque", a paleta de roupa). A produção escolhe quais Fields cada Event item tem e como se chamam; um Event item pode ter vários, de tipos diferentes, mas um Field nunca mistura tipos. Lista, telefone e link são Fields de texto. Cada foto de um Field de fotos pode ter uma legenda curta (ex.: "Azul petróleo #1F4E5F" sob a foto da roupa). Um Field de pessoas aceita, além de Users, nomes soltos de quem não tem login (ex.: o motorista local), que só aparecem ali. Um nome solto nunca vira User sozinho: a produção pode vinculá-lo a um User, o que troca o nome por essa pessoa em todos os Fields do Event.
_Avoid_: atributo, propriedade, bloco

**Item template** (modelo de item):
Um Event item de molde de um Group (ex.: "Saída terrestre" com Local em Highlight e os Fields de pessoas Carro 1 e Carro 2), escolhido ao criar um Event item. Traz o nome do item, os Fields (com ou sem valor, Highlight e ordem), o Audience ("Todos" ou Teams, que só copiam quem deles está no Event) e o lugar; nunca a hora nem pessoas avulsas. Tudo é copiado: editar o Item template depois não muda nenhum Event item. Um Item template automático cria o seu Event item sozinho em todo Event novo (ex.: "O que levar"). Um Group nasce com os Item templates da plataforma, só com os nomes e tipos dos Fields, e os ajusta como quiser.
_Avoid_: tipo de item (sugere vínculo vivo), template de evento, categoria

**Saved field** (Field salvo):
Um Field pronto de um Group, com nome, tipo, valor e Highlight (ex.: a paleta Azul, com as fotos e as legendas; o contato da produção), que a produção insere em qualquer Event item a qualquer momento, como cópia: editar o Saved field depois não muda nenhum Event item. Um Item template pode incluí-lo, e então o Event item recebe o valor que ele tiver no momento da criação.
_Avoid_: paleta (é um Saved field de fotos), preset, valor padrão

**Item lead** (responsável pelo item):
A pessoa que cuida de um Event item, no máximo uma por item e opcional: um Owner, um Event manager ou um Viewer que seja Participant do Event, nunca um Event guest. Para o Owner, é só a marca de quem cuida; o Event manager edita os Event items de que é Item lead; o Viewer só sugere alterações, que a produção confirma ou rejeita. Quem cria um Event item vira o Item lead dele.
_Avoid_: responsável (sem qualificador), dono do item, Author (é quem editou por último), assignee

**Personal note** (nota individual):
O valor de uma pessoa dentro de um Field de pessoas (ex.: o localizador dela, "dirigindo"). Por padrão só ela e a produção veem; o Field pode torná-las visíveis para todos.
_Avoid_: observação (é um Field de texto), comentário

**Participant** (participante):
Uma pessoa que vai a um Event. Cada Event tem a sua lista de Participants, um recorte de quem é do Group (ex.: 20 dos 30 integrantes do Vocal Livre vão a Manaus). A lista nasce como cópia de todos os Group members (Owners e Viewers) ou, se a produção preferir, de um ou mais Teams (ex.: só a Banda, para um ensaio da Banda), e a produção ajusta quem vai; quem entra no Group depois não vira Participant de Events já criados sem ser adicionado. Vale para o Event inteiro: quem vai só em parte (ex.: só na volta) é Participant, e o recorte fica nos Audiences. Ser Participant independe do papel: um Owner que não vai continua editando o Event. Todo Group member vê a lista de Participants de qualquer Event do Group, vá ou não. Quem deixa de ser Participant sai dos Audiences, mas continua nos Fields de pessoas marcado como fora do Event, até a produção reorganizá-los.
_Avoid_: convidado, integrante (do Event), Attendee

**Audience** (público):
Quem um Event item alcança, sempre dentro dos Participants e Event guests do Event. Ou é "Todos", que acompanha a lista de Participants (quem entra no Event passa a ser alcançado) e nunca inclui Event guests, ou é uma lista de pessoas escolhidas, montada com Teams, Participants avulsos e Event guests, que não muda sozinha. Quem aparece num Field de pessoas do Event item também está no Audience dele, enquanto estiver no Field (vale para Participants e Event guests; quem está marcado como fora do Event não conta). Uma pessoa só vê os Event items cujo Audience a inclui.
Não é a plateia de uma apresentação.
_Avoid_: quem, destinatários, participantes (do item), plateia

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
Uma pessoa com login na plataforma, única por email e independente de quantos Groups ela participa. Tem sempre um telefone, que é só contato (ex.: abrir o WhatsApp dela), não identifica nem serve para login. Os Group members veem o telefone uns dos outros; Event guests e Event managers só trocam telefone com a produção (os Owners e os Event managers daquele Event). Nasce pelas mãos do Super admin ou implicitamente quando um Owner adiciona como Group member ou Event guest um email que ainda não tem User; não há cadastro aberto.
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

**Team** (equipe):
Um conjunto de Group members com nome, mantido pelos Owners do Group (ex.: Cantores, Banda, Técnica, Produção; Técnica, quem cuida de som e luz, é outro Team, não a Produção). O Team Produção é só um Team, e quem está nele pode ser Viewer; não se confunde com "a produção", quem edita (Owners e Event managers). A lista de Teams é plana, e uma pessoa pode estar em vários Teams ou em nenhum, independente do papel. Escolher um Team num Audience só copia quem está nele naquele momento: mudar o Team depois não muda nenhum Audience.
_Avoid_: naipe, Section, agrupamento, Grouping, subgrupo

**Owner**:
Group member que responde pelo Group: edita o Group, os membros, os Events e os Event items. É a produção.
_Avoid_: dono (sem qualificador), admin do grupo, produtor

**Viewer**:
Group member que só consulta: vê todos os Events do Group que não são Archived events, cada um filtrado pelos Audiences. De um Event de que não é Participant, vê só que ele existe (onde e quando), já que nenhum Audience o alcança.
_Avoid_: leitor, participante, convidado

**Event manager**:
O vínculo entre um User e um único Event, para quem ajuda a montá-lo sem ser Owner (ex.: um produtor local de Manaus que cuida dos traslados). Cria Event items e edita só aqueles de que é Item lead; dos outros, vê os publicados, independente do Audience, sem editar. Usa os Item templates e Saved fields do Group, que só os Owners mantêm. Não é Group member.
_Avoid_: Manager (sem qualificador), organizador, gerente, editor

**Event guest** (convidado do evento):
O vínculo entre um User e um único Event, para quem vai junto sem ser do Group (ex.: um baixista convidado para os shows de Manaus). Só vê os Event items cujo Audience o inclui, escolhido pelo nome ou escalado num Field de pessoas: o "Todos" não o alcança, e ele não vê nada mais do Group. Não é Group member nem Participant. Os Group members veem quem são os Event guests de cada Event, à parte da lista de Participants; o Event guest não vê essas listas. Só os Owners adicionam e removem Event guests. Quem é removido perde o acesso na hora e sai dos Audiences, mas, como o Participant que sai, continua nos Fields de pessoas marcado como fora do Event até a produção reorganizá-los. Se virar presença fixa, entra no Group como Viewer, o que não muda os Events em que já é Event guest: só vira Participant deles se um Owner trocar um vínculo pelo outro, já que ninguém é Participant e Event guest do mesmo Event.
_Avoid_: Guest (sem qualificador, era o convidado de RSVP), músico convidado, extra, Viewer temporário

**Guest access link** (link de acesso do convidado):
Link pessoal pelo qual um Event guest entra na plataforma sem senha, já como o User dele, vendo só aquele Event. A produção o gera e entrega. Vale até pouco depois do fim do Event, e a produção pode revogá-lo e gerar outro. Quem quiser continuar define uma senha como qualquer Pending user.
_Avoid_: link mágico, convite, link público, Activation link (esse define senha)

**Membership** (vínculo):
Os vínculos de quem está fazendo a requisição, vistos a partir dele: o papel no Group e os Events de que é Event manager ou Event guest. O Super admin não tem Membership.
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
