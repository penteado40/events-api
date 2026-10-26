# Leitura da programação por query service e regra de alcance única

A pergunta "este Event item alcança esta pessoa, e o que dele ela vê?" aparece em quatro lugares: no Summary e na Timeline, na escrita (só abre um Request ou edita a própria Personal note quem o item alcança), no Change log (a Change aparece para quem o item alcançava antes ou depois dela) e na Notification e no Last seen (o que mudou para você). Decidimos que essa regra mora num **domain service puro**, que recebe um retrato do Event item (Draft, publicado ou Cancelled, Audience, quem está nos Fields de pessoas, visibilidade das Personal notes) e o vínculo da pessoa com o Event. O Summary e a Timeline **não passam pelas entidades**: um port de leitura carrega o Event inteiro como dados simples, e cada item passa pela regra. As escritas continuam pelas entidades.

## Regras

- Uma leitura de programação é sempre de um Event só, carregado inteiro e filtrado em memória. Um Event tem dezenas de Event items e de pessoas, não milhares. Nenhuma tela junta Event items de vários Events.
- A regra de alcance não vai para SQL nem para método de entidade. Repositório e port de leitura só trazem os dados.
- Cada Change grava quem o item alcançava antes e depois dela, calculado pela regra naquele momento. O Change log filtra por essas listas e nunca reconstrói o passado: quem sai do Event depois continua nelas, mas já não abre o Event.
- Uma única função de domínio calcula a diferença líquida das Changes de um Event entre dois instantes para uma pessoa. A Notification usa a janela de 10 minutos, e o Last seen usa do último Last seen até agora (riscado, novo e fantasma). Nada guarda um retrato por pessoa do que ela viu.

## Considered Options

- **Filtrar o Audience em SQL.** Descartado: o Change log e a Notification avaliam o estado de antes e de depois de uma Change, que não está no banco como linha consultável, e a regra acabaria escrita duas vezes, uma em SQL e outra em TypeScript.
- **Método na entidade (`eventItem.isVisibleTo(person)`).** Descartado: amarra a regra ao agregado hidratado, enquanto o cálculo do alcance de antes de uma Change precisa avaliar um estado que a entidade já deixou para trás. Na leitura, também obrigaria a hidratar entidades só para descartá-las.
- **Recalcular na leitura quem cada Change alcançou.** Descartado: exigiria o histórico da lista de Participants e de cada Audience. Gravar algumas dezenas de ids por Change é mais barato e não envelhece.
- **Guardar por pessoa um retrato do que ela viu (para o Last seen).** Descartado: cada edição atualizaria um retrato por Participant, e a regra de visibilidade voltaria a ter dois donos.

## Consequences

- A `arquitetura.md` ganha os ports de leitura: os repositórios servem às escritas e devolvem agregados; as telas de leitura usam um port no `application`, com implementação Prisma no `infrastructure`, que devolve dados simples.
- O retrato do Event item é um tipo do domínio, sem comportamento, montado tanto pela entidade (na escrita, antes e depois da mudança) quanto pelo port de leitura. O que se grava na Change é só o alcance resultante, não o retrato.
- O alcance gravado em cada Change é dado: mudar a regra de alcance depois não muda quem viu as Changes antigas.
