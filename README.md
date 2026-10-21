# NFC.APP

Fundação técnica da plataforma SaaS de gerenciamento de placas NFC. Este repositório inicia um monólito modular e deliberadamente não contém funcionalidades de negócio.

## Stack

- Frontend: Angular 21, TypeScript strict, componentes standalone, Router e SCSS.
- Backend: Java 21, Spring Boot 3.5.x, Maven, Spring Web/Data JPA/Security/Actuator/Validation e Flyway.
- Banco: PostgreSQL 17.
- Infraestrutura: Docker Compose, Caddy e GitHub Actions.

## Pré-requisitos

Para executar tudo em containers: Docker Engine/Desktop com Docker Compose v2. Para desenvolvimento fora do Docker: Node.js 24 LTS, npm 11, JDK 21 e Maven 3.6.3 ou superior.

## Estrutura

```text
frontend/                 Aplicação Angular, testes e Dockerfile
backend/                  API Spring Boot, migrações Flyway e testes
infrastructure/caddy/     Configuração Caddy local e produção
infrastructure/scripts/   Backup e restauração PostgreSQL
.github/workflows/        CI de build e testes
compose.yml               Stack local
compose.prod.yml          Sobrescritas para HTTPS/wildcard
.env.example              Modelo de configuração local
```

## Configuração e inicialização local

1. Copie `.env.example` para `.env` e substitua `POSTGRES_PASSWORD` por uma senha aleatória forte. O `.env` não é versionado.
2. Na raiz do projeto, execute:

```sh
docker compose up -d --build
```

O frontend estará em `http://localhost` (ou na porta de `HTTP_PORT`). O Caddy encaminha `/api/*` ao backend. O status mínimo da API pode ser consultado em `http://localhost/api/status`; o health check do Actuator é `http://localhost/actuator/health` apenas dentro da rede Docker, pois somente `/api/*` é encaminhado pelo proxy.

O banco não publica portas no host. PostgreSQL usa o volume nomeado `postgres_data`; `docker compose down` preserva os dados. Para removê-los explicitamente, use `docker compose down -v` (operação destrutiva).

## Logs e operações

- Todos os serviços: `docker compose logs -f`
- Um serviço: `docker compose logs -f backend` (também `frontend` ou `database`)
- Estado e health: `docker compose ps`
- Parar/remover containers e rede, preservando banco: `docker compose down`

A migração inicial Flyway é aplicada automaticamente ao iniciar o backend. Hibernate está em `ddl-auto: validate`; criação/alteração futura de esquema deve ocorrer exclusivamente por novas migrações Flyway.

## Desenvolvimento e testes

Frontend:

```sh
cd frontend
npm ci
npm run build
npm test
```

Backend (com JDK 21 e Maven):

```sh
cd backend
mvn verify
```

Também é possível validar a configuração Compose e executar os testes com Docker:

```sh
docker compose --env-file .env.example config --quiet
docker compose up -d --build
```

O workflow do GitHub Actions executa build e testes frontend/backend e valida a configuração do Compose. Não há deploy automático.

## Backup e restauração

Com Docker ativo, `.env` configurado e serviços em execução, na raiz:

```sh
bash infrastructure/scripts/backup.sh
bash infrastructure/scripts/restore.sh backups/nfcapp-AAAAMMDDTHHMMSSZ.dump
```

Os dumps custom-format recebem timestamp UTC. A restauração pede confirmação e substitui objetos no banco; confira o arquivo antes de prosseguir. Em Windows, execute esses scripts com Git Bash ou WSL. Backups de produção devem ficar fora da VPS, com acesso protegido, e a restauração deve ser testada periodicamente. Não há agendamento automático.

## Preparação futura para VPS Linux

Use uma VPS com Docker Engine e Compose v2, configure firewall para SSH e portas TCP 80/443 (e UDP 443 para HTTP/3), mantenha o host atualizado e não exponha o banco nem a API diretamente. Defina credenciais fortes e domínio em `.env` e use a composição de produção:

```sh
docker compose -f compose.yml -f compose.prod.yml up -d --build
```

Configure os registros DNS `A`/`AAAA` de `nfc.app.br` e `*.nfc.app.br` para o IP da VPS. O arquivo de produção está preparado para Cloudflare DNS-01: defina `CADDY_DNS_API_TOKEN` com permissão mínima de edição DNS. Certificados wildcard exigem validação DNS-01 e módulo de DNS compatível no Caddy; apontar o DNS sozinho não emite certificados wildcard. Para outros provedores, substitua o módulo e a configuração. Consulte [infrastructure/README.md](infrastructure/README.md) para os detalhes operacionais.
