# Comprovante opcional, privado e enviado direto ao Cloudinary

Ao marcar uma Contribution como paga, o Guest é incentivado (não obrigado) a anexar um Receipt, uma foto ou PDF do comprovante. Tornar obrigatório travaria quem pagou por outro aparelho; Contributions `PAID` sem Receipt aparecem sinalizadas na Verification.

Como um comprovante de Pix tem nome, banco e parte do CPF, ele fica no Cloudinary com `type: authenticated` (sem URL pública), em uma pasta separada por evento. O banco guarda só o `publicId`, o tipo de arquivo e a data. Membros veem o arquivo por uma URL assinada de curta duração. O upload vai **direto do navegador para o Cloudinary**, com parâmetros assinados pela API, porque as Vercel Functions limitam o corpo da requisição a 4,5 MB (ADR-0007). O `mark-paid` recebe só o `receiptPublicId`, e a API confere que o arquivo está na pasta daquela Contribution.

## Consequences

- Limpeza de comprovantes X meses após o evento (LGPD) fica para a V2 e é um ponto de atenção explícito.
