# Guest access link: o Event guest entra sem senha

O Event guest (ex.: um baixista convidado para os shows de Manaus) precisa ver a programação de um único Event sem ser do Group, e muitas vezes é adicionado dias antes da viagem. Exigir que ele ative a conta e crie uma senha, como um Pending user, travaria justo quem menos usa a plataforma. Decidimos abrir uma **segunda porta de entrada, sem senha**: o **Guest access link**, um link pessoal que a produção gera e entrega, pelo qual o Event guest entra já como o User dele, vendo só aquele Event. Quem quiser continuar define uma senha como qualquer Pending user.

## Regras

- O link vale para um Event só e para um User só, e nunca dá acesso a mais nada do Group, mesmo que o User seja Group member em outro lugar.
- Vale enquanto o vínculo do Event guest valer: até o fim do Event, mais 7 dias só de consulta (ADR-0017). Remover o Event guest derruba o link na hora.
- Só os Owners geram, revogam e regeram o link. Regerar invalida o anterior.
- O link não define senha e não se confunde com o Activation link, que é de uso único e serve só para isso.

## Considered Options

- **O Event guest como Pending user com senha**, entrando pelo login normal. Descartado pelo atrito: a ativação é o passo que o convidado de uma viagem só pularia, e a produção acabaria mandando a programação por fora da plataforma.
- **Um link público do Event, sem identificar a pessoa.** Descartado: o Event guest vê só os Event items cujo Audience o inclui, e o Change log, as Personal notes e os telefones dependem de saber quem ele é.

## Consequences

- A autenticação deixa de ter uma só credencial de entrada. Uma sessão aberta pelo Guest access link carrega o Event a que ela se limita, e a AccessPolicy precisa recusar qualquer outra coisa nessa sessão, mesmo que o User tenha outros vínculos.
- O link é uma credencial que vive dias, não minutos: a API guarda só o hash, como o Activation link, e a produção precisa poder revogá-lo se ele vazar.
- A retenção e a LGPD dos Guest access links depois do Event ainda estão em aberto no mapa do pivô (PROJ-51).
