# Senha de 8 caracteres com regras de composição

A política de senha seguia o NIST 800-63B: mínimo de 12 caracteres e nenhuma regra de composição. Para reduzir o atrito na ativação e na troca de senha, decidimos baixar o mínimo para **8 caracteres** e, em troca, exigir **ao menos uma letra maiúscula (`A–Z`), uma minúscula (`a–z`), um dígito (`0–9`) e um símbolo** da pontuação ASCII (``!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~``, sem o espaço). O máximo de 72 bytes do bcrypt continua. É um desvio consciente do NIST, que desaconselha regras de composição porque empurram as pessoas para padrões previsíveis (`Senha@2026`); escolhemos a regra que o usuário reconhece como "senha forte" e que cabe numa senha mais curta.

## Consequences

- Só caracteres ASCII contam para os requisitos. Letras acentuadas (`ç`, `É`) e outros caracteres são aceitos na senha, mas não satisfazem nenhum requisito: `joão1!ÉÉ` é recusada por não ter maiúscula ASCII.
- A regra vale só quando uma senha é definida (ativação, troca de senha, `create-super-admin`). O login não a verifica, então senhas definidas sob a regra antiga continuam funcionando e ninguém é obrigado a trocá-las.
- `WEAK_PASSWORD` continua um único código, sem `details`; a mensagem descreve a regra inteira. O Site mostra o checklist localmente, e a API é só a última barreira.
