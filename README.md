# NFC.APP

Plataforma SaaS para criar e gerenciar placas NFC, com redirecionamento público persistente e planos por organização.

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
2. Para publicar links em produção, configure `APP_DOMAIN` com o domínio HTTPS público; `compose.prod.yml` usa `https://APP_DOMAIN` como origem dos links NFC.APP. Para habilitar a busca de estabelecimentos, configure `GOOGLE_PLACES_API_KEY` com uma chave restrita à Google Places API (New). Sem essa chave, o formulário continua aceitando links de avaliação inseridos manualmente.
3. Na raiz do projeto, execute:

```sh
docker compose up -d --build
```

O frontend estará em `http://localhost` (ou na porta de `HTTP_PORT`). O Caddy encaminha `/api/*` ao backend. O status mínimo da API pode ser consultado em `http://localhost/api/status`; o health check do Actuator é `http://localhost/actuator/health` apenas dentro da rede Docker, pois somente `/api/*` é encaminhado pelo proxy.

Para conectar ao PostgreSQL pelo DBeaver na máquina local, use o driver PostgreSQL com host `localhost`, porta `5432`, database `nfcapp` e usuário `nfcapp`. A senha é o valor de `POSTGRES_PASSWORD` no arquivo `.env`; database e usuário também podem ser conferidos ali. A porta é vinculada somente a `127.0.0.1`, sem exposição à rede externa. Se alterar a configuração ou habilitar essa porta pela primeira vez, aplique-a com `docker compose up -d database`.

PostgreSQL usa o volume nomeado `postgres_data`; `docker compose down` preserva os dados. Para removê-los explicitamente, use `docker compose down -v` (operação destrutiva).

## Logs e operações

- Todos os serviços: `docker compose logs -f`
- Um serviço: `docker compose logs -f backend` (também `frontend` ou `database`)
- Estado e health: `docker compose ps`
- Parar/remover containers e rede, preservando banco: `docker compose down`

A migração inicial Flyway é aplicada automaticamente ao iniciar o backend. Hibernate está em `ddl-auto: validate`; criação/alteração futura de esquema deve ocorrer exclusivamente por novas migrações Flyway.

O login Google é mantido no navegador e a sessão do servidor é renovada automaticamente quando expira ou o navegador é reaberto. Ao sair, ambas as sessões são encerradas. A permanência depende do armazenamento do navegador e da validade da autenticação Google; limpeza dos dados, revogação de acesso ou uso de navegação privada podem exigir novo login. Em computadores compartilhados, encerre a sessão ao terminar.

## Placas NFC

É possível publicar placas sem login para conhecer a plataforma. Essas publicações não estão vinculadas a um plano e seguem o limite de requisições por endereço de origem. Ao publicar com login, a placa é vinculada à organização da conta. O plano Start permite até três placas publicadas; edições de placas ativas não consomem uma nova vaga. Placas anônimas podem ser associadas após o login, mesmo que o consumo ultrapasse o limite. Nesse caso, novas publicações e reativações ficam bloqueadas até haver uma vaga. Placas anônimas desativadas precisam ser vinculadas a uma conta antes de serem reativadas. A interface ainda não mostra o limite do plano.

O identificador público permite somente o redirecionamento; uma credencial de gerenciamento diferente é mantida no `localStorage` do navegador que criou a placa. A gestão por credencial de placas associadas também exige a sessão do proprietário. Após o login, placas publicadas ainda não associadas são vinculadas à conta usando essa credencial, e as placas da conta são importadas para o navegador. Limpar os dados antes de associar uma placa pode impedir seu gerenciamento por este navegador, mas não invalida a placa pública. Clientes e vínculos continuam locais.

## Planos

Cada nova conta recebe uma organização pessoal e uma assinatura Start (FREE). A migration V8 cria assinaturas FREE para organizações existentes e organizações pessoais para usuários sem vínculo. Enquanto não houver seleção de organização, a organização corrente é o primeiro vínculo por data e identificador.

`GET /api/plans` apresenta o catálogo e `GET /api/organizations/current/plan` requer sessão autenticada e informa assinatura, capacidades, limite e consumo de placas ativas. `entitled` indica a capacidade prevista no plano e `enabled` indica que ela também está disponível; capacidades Pro futuras permanecem indisponíveis. O preço inicial do Pro é R$ 29,90 mensal, armazenado no catálogo `plans` e configurável por operação administrativa no banco. Alterar o preço não implementa cobrança nem checkout. Não há endpoint para mudar planos; futuras integrações de pagamento devem fazer a transição por código confiável, usando o serviço de planos e seu bloqueio transacional.

O caminho `/t/{id}` é encaminhado pelo Caddy ao backend. Links HTTPS são redirecionados sem cache permanente; placas Pix exibem o payload estático BR Code e seu QR Code. O NFC.APP não processa pagamentos. A busca Google Places e a criação/consulta de placas têm limites básicos por endereço de origem.

Após criar uma placa, escolha **Gravar placa NFC**. Em Android com navegador compatível e NFC habilitado, a Web NFC grava o link dinâmico diretamente, sem outro aparelho. A primeira tentativa não substitui conteúdo existente. Se for recusada, permita o NFC ou verifique o conteúdo da placa; após identificar dados, é possível confirmar a substituição e aproximar a mesma placa novamente. Cartões bloqueados ou incompatíveis não podem ser gravados. O iPhone requer um aplicativo NFC. No computador, o QR Code abre a gravação no celular sem transferir a credencial de gerenciamento ou adicionar a placa ao armazenamento local do celular. Qualquer pessoa com esse QR Code pode gravar e testar o link público; não o compartilhe com desconhecidos. O QR Code do link da placa é opcional e não é necessário para a gravação. O link precisa estar ativo no backend. Teste o destino e, quando disponível, verifique o conteúdo por leitura NFC.

A Web NFC exige um contexto seguro. Em produção, configure `APP_DOMAIN` para o domínio HTTPS público correto. Endereços `localhost` são úteis para desenvolvimento local, mas não permitem continuar pelo celular, pois apontam para o próprio dispositivo.

## Dashboard

A página inicial apresenta o resumo das placas e clientes deste navegador. Após o login, as placas associadas à conta são sincronizadas; clientes permanecem locais. O faturamento é a soma dos valores de venda informados nas placas, não uma confirmação de pagamento. Os filtros usam a data de criação das placas e dos clientes; placas ativas refletem o status armazenado localmente. Os gráficos exibem os últimos 6 ou 12 meses dentro do período escolhido, que pode ser maior do que o intervalo visualizado.

## Clientes

Ao criar uma placa e gerar seu link, o navegador cadastra o estabelecimento como cliente e vincula a placa, independentemente da gravação NFC. Estabelecimentos selecionados na busca Google são identificados pelo Google Place ID; para placas sem Place ID, o agrupamento usa o nome, ignorando diferenças de maiúsculas e espaços extras. Nomes iguais podem representar estabelecimentos diferentes, portanto confira-os antes de criar a placa. Se uma placa anterior já estiver salva neste navegador com link público, ela também será associada ao abrir Clientes.

Clientes e vínculos ficam no `localStorage` deste navegador e não são sincronizados entre dispositivos ou contas. A edição da placa atualiza o vínculo; a remoção da placa elimina seu vínculo, mas mantém o cliente. Limpar os dados do navegador também remove os clientes. Os números de scans exibidos no aplicativo são simulados e não representam telemetria real. O relatório PDF apresenta reputação no Google e placas, indicando que dados de interação ainda não estão disponíveis, sem incluir esses números simulados. Para clientes associados ao Google, a geração consulta novamente o Places e inclui até cinco avaliações disponíveis selecionadas por relevância, não necessariamente as mais recentes. Essa consulta pode gerar cobrança adicional do Google. Se a consulta falhar, o relatório não é gerado. Clientes sem Google Place ID não têm avaliações individuais no relatório.

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
FIREBASE_PROJECT_ID=ci-placeholder docker compose --env-file .env.example config --quiet
docker compose up -d --build
```

O workflow de CI do GitHub Actions executa build e testes frontend/backend e valida a configuração do Compose. Um workflow independente constrói e publica as imagens no GHCR para commits em `master`, inclusive por execução manual nessa branch. **Confira o resultado do CI antes de publicar na VPS**: uma falha no CI não bloqueia a construção das imagens nem o deploy manual. Não há deploy automático.

As imagens usam o SHA completo do commit como tag:

- `ghcr.io/leoteixeiraa/nfc-app-br-backend:<SHA>`
- `ghcr.io/leoteixeiraa/nfc-app-br-frontend:<SHA>`

Após o primeiro build, configure os dois pacotes como públicos nas configurações de pacotes do GitHub para que a VPS possa baixá-los sem credenciais. O deploy é executado manualmente na VPS, usando sua configuração própria e os segredos do `.env` local; não inclua segredos nas imagens ou no repositório.

A imagem publicada do frontend usa o estágio `runtime`, sem o módulo DNS da Cloudflare. Ela não substitui diretamente o estágio `wildcard-runtime` usado pelo Compose de produção deste repositório para certificados wildcard; a configuração própria da VPS deve ser compatível com a imagem publicada.

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
