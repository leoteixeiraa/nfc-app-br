# Infraestrutura e operações

## Topologia

O Caddy é o único serviço com portas publicadas no host. Ele serve os arquivos compilados do Angular e encaminha `/api/*` ao backend. API e PostgreSQL permanecem na rede Docker privada do projeto.

## Produção e HTTPS

1. Configure `APP_DOMAIN=nfc.app.br` e um `CADDY_DNS_API_TOKEN` de escopo mínimo no `.env` da VPS.
2. Aponte os registros DNS `A` e, se aplicável, `AAAA` de `nfc.app.br` e `*.nfc.app.br` para o endereço da VPS.
3. Libere TCP 80/443 e UDP 443 no firewall.
4. Inicie com `docker compose -f compose.yml -f compose.prod.yml up -d --build`.

O Caddyfile de produção usa o módulo DNS para Cloudflare. Certificados wildcard **não são obtidos automaticamente** apenas por apontar o DNS: exigem validação DNS-01 e um módulo/provedor DNS compatível com a zona. O token precisa permitir edição DNS e ser mantido como segredo fora do repositório. Para outro provedor, compile o Caddy com o módulo correspondente e ajuste o Caddyfile e as credenciais. O domínio raiz e o wildcard são configurados para receber HTTPS.

## Backup e restauração

A partir da raiz do repositório, com o `.env` configurado e os serviços ativos:

- `bash infrastructure/scripts/backup.sh` grava um dump PostgreSQL no formato custom em `backups/`, com data/hora UTC.
- `bash infrastructure/scripts/restore.sh backups/arquivo.dump` solicita confirmação explícita e substitui objetos do banco conforme o dump.

Os backups de produção devem ser copiados para fora da VPS, protegidos conforme a política de dados e testados periodicamente por uma restauração em ambiente separado. Os scripts não agendam nem criptografam backups.

## Preparação de uma VPS Linux

Instale Docker Engine e o plugin Docker Compose a partir dos repositórios oficiais para a distribuição. Clone o repositório, prepare `.env` com credenciais aleatórias e domínio, configure DNS e firewall e então inicie a configuração de produção descrita acima. Restrinja SSH, mantenha o sistema atualizado e monitore espaço em disco e backups. Não publique diretamente as portas do backend ou do PostgreSQL.
