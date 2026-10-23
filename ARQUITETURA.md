# NFC.APP — Arquitetura e execução

```mermaid
flowchart LR
    B[Navegador] -->|HTTP :80 / HTTPS :443| C[Caddy: arquivos Angular]
    C -->|/api/* na rede interna| A[Spring Boot]
    A --> D[(PostgreSQL 17<br/>volume persistente)]
```

Somente o Caddy publica portas no host. O backend e o banco ficam na rede Docker privada.

## Modelo de dados inicial

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ ORGANIZATION_MEMBERSHIPS : inclui
    USERS ||--o{ ORGANIZATION_MEMBERSHIPS : participa
    ORGANIZATIONS ||--o{ NFC_TAGS : gerencia
    NFC_TAGS ||--o{ REDIRECT_LINKS : possui
    NFC_TAGS ||--o{ ACCESS_EVENTS : recebe
    REDIRECT_LINKS ||--o{ ACCESS_EVENTS : referencia
```

A migração Flyway V2 cria essas tabelas. Um destino pode estar ativo por placa; eventos guardam placa, destino e horário, sem IP ou user-agent.

## Executar localmente

1. Configure `.env` (já criado; altere a senha se necessário).
2. Na raiz do repositório:

```sh
docker compose up -d --build
```

Frontend: http://localhost  
Status da API: http://localhost/api/status

## Autenticação Firebase

Crie um app Web no Firebase Console, habilite **Authentication > Sign-in method > E-mail/senha** e **Google**, e cadastre as contas autorizadas. Na configuração do provedor Google, use o ID de cliente Web OAuth criado para o projeto. Copie do app Web os valores `apiKey`, `authDomain`, `projectId` e `appId` para as variáveis `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID` e `FIREBASE_APP_ID` do `.env` (os nomes estão em `.env.example`). Inclua `localhost` e o domínio de produção em **Authentication > Settings > Authorized domains**. Depois reconstrua o frontend:

```sh
docker compose up -d --build frontend
```

A configuração Web é pública por natureza; restrinja a chave às APIs necessárias e configure os domínios autorizados no Firebase Authentication.

## Comandos úteis

```sh
docker compose ps
docker compose logs -f
docker compose up -d --build frontend
docker compose restart frontend
docker compose down
```

Use `docker compose up -d --build frontend` após alterar o código ou as dependências do frontend; o build é incluído na imagem Docker. Use `docker compose restart frontend` somente para reiniciar o serviço sem reconstruir a imagem.

`down` mantém os dados do banco. Para apagá-los explicitamente: `docker compose down -v`.

## Produção

Configure `APP_DOMAIN` e `CADDY_DNS_API_TOKEN`, crie DNS para o domínio raiz e wildcard e execute:

```sh
docker compose -f compose.yml -f compose.prod.yml up -d --build
```

Wildcard HTTPS requer DNS-01 e um provedor/módulo DNS compatível no Caddy.
