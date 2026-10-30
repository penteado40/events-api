---
status: superseded by ADR-0016
---

# Ids inteiros sequenciais, preservados na migração

> Substituído pelo ADR-0016 (pivô para Groups, 2026-10-02): sem migração da `fawedding-api`, não há ids a preservar. Os ids `Int` com autoincremento continuam como padrão das tabelas, mas o motivo deste ADR deixou de existir.

Mantemos ids `Int` com autoincremento e preservamos os ids da `fawedding-api` (eventos 1, 2 e 4). Os Sites usam o id do evento na URL da API, então preservá-los reduz a mudança nos frontends a trocar o prefixo `/weddings/:id` por `/events/:id`. Consideramos UUID/cuid (ids não adivinháveis) e slug nas rotas públicas, mas o ganho não compensa o custo de mapear ids na migração e de ter duas formas de buscar um evento. A exposição de ids sequenciais é mitigada onde importa: uma Contribution só pode ser alterada pelo Guest com o Contribution token dela (ADR-0004), não pelo id.
