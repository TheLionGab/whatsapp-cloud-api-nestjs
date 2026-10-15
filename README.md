# whatsapp-cloud-api-nestjs

Serviço Node.js + TypeScript para a
[WhatsApp Business Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)
da Meta: envio de mensagem de texto e webhook (verificação + recepção).

Este projeto é um **porte para NestJS** do serviço Express
[`whatsapp-cloud-api-node`](https://github.com/TheLionGab/whatsapp-cloud-api-node).
As rotas, os status HTTP e os corpos de erro são os mesmos; mudou a
arquitetura. **Nunca foi testado contra a API real da Meta**: a integração
é coberta só por `fetch` injetado nos testes.

## Endpoints

- `GET /health` responde `{ "status": "ok", "service": "whatsapp-cloud-api-node" }`
  (o nome do serviço foi mantido igual ao do projeto Express, de propósito).
- `GET /webhook` responde ao desafio da Meta (`hub.mode`, `hub.verify_token`,
  `hub.challenge`). Token errado: 403 `verify_failed`.
- `POST /webhook` recebe eventos e responde `{ "received": true }`. Confere
  `X-Hub-Signature-256` (HMAC-SHA256 do corpo **cru**) quando há
  `WHATSAPP_APP_SECRET`. Assinatura ausente ou errada: 401 `invalid_signature`.
- `POST /messages/text` envia texto, com `Authorization: Bearer <SEND_API_KEY>`:
  `{ "to": "5565999990000", "body": "olá", "previewUrl": false }`.
  Chave errada: 401 `unauthorized`; corpo inválido: 400 `invalid_body`;
  Meta recusa ou rede falha: 502 `provider_error`; sem token ou
  phone number id fora do dry-run: 500 `missing_credentials`.

Erros têm sempre o formato `{ "error": { "code", "message" } }`
(`details` aparece em `invalid_body`).

## Mapa da arquitetura Nest

- Módulos
  - `AppModule` (`src/app.module.ts`): raiz; liga o filtro de exceções global.
  - `ConfigModule` (`src/config/`): global; lê o ambiente, valida com Zod e
    expõe a config pelo token `APP_CONFIG`.
  - `LoggingModule` (`src/logging/`): `nestjs-pino`, com
    `authorization`, `cookie` e `x-hub-signature-256` mascarados, e a URL
    gravada só com o caminho (a query de `GET /webhook` traz o
    `hub.verify_token` e não vai para o log).
  - `WhatsappModule` (`src/whatsapp/`): envio e webhook.
- Controllers: `HealthController`, `WebhookController`, `MessagesController`.
- Provider externo: `WhatsappService` (fala com a Graph API). O `fetch`
  entra pelo token `FETCH`, então o teste troca por um falso com
  `overrideProvider`.
- Guards
  - `SendKeyGuard`: `Bearer SEND_API_KEY`, comparação em tempo constante.
  - `WebhookSignatureGuard`: HMAC-SHA256 sobre `req.rawBody`
    (`NestFactory.create(AppModule, { rawBody: true })`, em `src/app.options.ts`).
- Pipe: `ZodValidationPipe` valida o corpo de `/messages/text`.
- Filter: `ApiExceptionFilter` converte qualquer exceção para o formato de erro.

A ordem é a do Nest: guard, pipe, handler. Em `/messages/text`, a chave é
conferida antes do corpo, como no projeto Express.

## Rodar

Requer Node 22.12 ou mais novo.

```bash
npm ci
npm run build
DRY_RUN=true WHATSAPP_VERIFY_TOKEN=um-texto-seu npm start
```

Se existir um arquivo de ambiente local na pasta atual, `src/main.ts` o
carrega sem sobrescrever variáveis já definidas. Desenvolvimento com
recarga: `npm run build:watch` em um terminal e `npm run start:watch` em outro.

## Variáveis de ambiente

Em `DRY_RUN` só `WHATSAPP_VERIFY_TOKEN` é obrigatório.

- `PORT`: padrão 3000.
- `WHATSAPP_VERIFY_TOKEN` (sempre obrigatório): texto que você inventa e
  cadastra no painel da Meta.
- `WHATSAPP_APP_SECRET`: valida a assinatura do webhook. Obrigatório fora do dry-run.
- `SEND_API_KEY`: chave que os clientes mandam em `Authorization: Bearer`.
  Obrigatória fora do dry-run.
- `WHATSAPP_TOKEN` e `WHATSAPP_PHONE_NUMBER_ID`: credenciais do app na Meta
  (exigidas no momento do envio).
- `WHATSAPP_GRAPH_VERSION`: padrão `v22.0`.
- `DRY_RUN=true` (ou `1`): responde sem chamar a Meta.
- `LOG_LEVEL`: padrão `info`.

## Verificação

```bash
npm run typecheck
npm test
npm run build
npm run test:local   # sobe o build em dry-run e exercita as rotas com curl
```

### Por que Vitest e não Jest

O Vitest 5 funciona com decorators do Nest, desde que a transformação seja
feita pelo SWC (`unplugin-swc`, em `vitest.config.ts`), porque o esbuild do
Vite não emite `emitDecoratorMetadata`, e sem ele a injeção por tipo não
resolve. Foi testado e os testes passam, então não foi preciso trocar para Jest.

### Testes

`tests/api.test.ts` e `tests/logging.test.ts` sobem o `AppModule` real com
`Test.createTestingModule`, trocam `APP_CONFIG` e `FETCH` por
`overrideProvider` e chamam o servidor HTTP com Supertest. Cobrem as mesmas
intenções dos 13 testes do projeto Express (health, verificação do webhook,
assinatura, chave de envio, corpo inválido, envio com `fetch` injetado,
dry-run, 502, validação de config) e mais casos: assinatura sobre o corpo
cru, log sem corpo nem cabeçalhos secretos, 500 `missing_credentials`, falha de
rede, JSON malformado e rota inexistente.

## Diferenças em relação ao projeto Express

- Rota inexistente, JSON malformado e erro inesperado respondem no formato
  `{ error: { code, message } }` (`not_found`, `http_error`,
  `internal_error`). O Express devolvia HTML do handler padrão.
- O log de requisição é o do `nestjs-pino` (formato de `req`/`res` do
  `pino-http` 11, com `context` nas linhas do controller).
- O framework traz Express 5 (via `@nestjs/platform-express`); o projeto
  irmão usa Express 4. O pipe normaliza `req.body` indefinido para `{}` para
  manter a resposta 400 idêntica.

## Limites conhecidos

- Não testado contra a API real da Meta.
- O `nestjs-pino` guarda o logger raiz em singleton de processo, então
  o destino e o nível do log valem para o primeiro app criado no processo
  (por isso o teste de log fica em arquivo próprio).
- Sem limite de taxa nem rotação da chave de envio.
- Sem templates, mídia, fila, retry nem persistência de status.
- Sem lint configurado: o typecheck é o gate estático.

## Licença

MIT.
