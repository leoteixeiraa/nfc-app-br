# Armazenamento local de placas

## Objetivo

Permitir que visitantes (sem login) configurem e gerenciem rascunhos de placas NFC no próprio navegador. Nada é enviado ao backend e nenhuma URL pública é gerada ou marcada como publicada.

## Chave

Uma única chave de `localStorage`: `nfcapp.tags.v1`, contendo um array JSON.

## Modelo

```ts
type NfcTagType = 'google-review' | 'whatsapp' | 'pix' | 'url';

interface NfcTag {
  id: string; // crypto.randomUUID()
  name: string;
  type: NfcTagType;
  destinationUrl: string; // sempre HTTPS (WhatsApp vira https://wa.me/<número>)
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
```

```json
[
  {
    "id": "0b8f6c1e-3c1a-4a52-9a54-5f6f3a0b7d11",
    "name": "Balcão da loja",
    "type": "whatsapp",
    "destinationUrl": "https://wa.me/5511999999999",
    "createdAt": "2026-01-10T12:00:00.000Z",
    "updatedAt": "2026-01-10T12:00:00.000Z"
  }
]
```

Código: `frontend/src/app/core/tags/` (`nfc-tag.ts` com modelo e validações; `local-tags.service.ts` com a persistência).

## Responsabilidade do serviço

`LocalTagsService` é o único ponto de acesso ao `localStorage`: `list`, `getById`, `create`, `update`, `duplicate` e `remove`. Ele valida entradas e registros lidos, ordena por `updatedAt` (mais recente primeiro) e lança `LocalTagsError` (`unavailable`, `corrupted`, `write`, `invalid`, `not-found`). Se o conteúdo salvo estiver inválido, a leitura falha e nenhuma escrita acontece, preservando o dado original.

## Fluxos

- **Criar:** formulário → validação por tipo → `create` grava → redireciona ao dashboard com a mensagem de sucesso (somente após a gravação).
- **Editar:** `/tags/:id/edit` carrega via `getById` → `update` grava e renova `updatedAt`.
- **Duplicar:** `duplicate` cria cópia com novo `id` e sufixo " (cópia)".
- **Excluir:** confirmação no dashboard → `remove`.

## Limitações

- Dados ficam apenas naquele navegador/dispositivo e perfil; não há backup nem acesso multi-dispositivo.
- Limpar dados do site ou modo anônimo apaga as placas.
- Cota de ~5 MB e possível indisponibilidade (navegação privada restrita, políticas do navegador).
- Não armazenar tokens ou dados sensíveis. Placas não têm URL pública (`nfc.app.br/r/:slug`).
- Google Avaliações aceita apenas hosts google.com, g.page, goo.gl e g.co.

## Evolução futura

Com usuário autenticado, as placas locais poderiam ser importadas para a conta (endpoint e tabela próprios, via migration), mantendo a chave `v1` como origem da importação e versionando o formato (`v2`) quando necessário.
