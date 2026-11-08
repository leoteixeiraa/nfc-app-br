# NFC.APP — Implementar fluxo completo de criação e gerenciamento de placas NFC

Atue como um **Product Owner, UX Designer e Desenvolvedor Full Stack Sênior**.

Implemente o fluxo completo de criação de placas NFC no projeto NFC.APP, priorizando simplicidade, experiência do usuário, reutilização de código e facilidade de manutenção.

## 1. Diretrizes obrigatórias

Antes de qualquer implementação:

- Analise a arquitetura, componentes, rotas, serviços, modelos e funcionalidades existentes.
- Reutilize ao máximo o código atual.
- **Não recrie layouts, componentes ou serviços que já existem.**
- Preserve o padrão visual do projeto, incluindo TailAdmin, Tailwind, dark mode, responsividade, botões, formulários e notificações.
- Faça somente as alterações necessárias.
- Não adicione bibliotecas desnecessárias nem implemente funcionalidades fora do escopo.
- Preserve o fluxo atual de autenticação, mas não exija login para criar placas.
- Mantenha a arquitetura Angular 21, Spring Boot Java 17 e PostgreSQL.

O objetivo é evoluir a funcionalidade **Minhas placas → Nova placa**, que já está implementada parcialmente.

## 2. Experiência de criação

O usuário deve conseguir criar e publicar uma placa NFC em poucos passos, sem precisar entender detalhes técnicos sobre NFC, URLs ou APIs.

O formulário deve permanecer simples, preferencialmente em uma única tela, com campos dinâmicos de acordo com o tipo de destino.

### Etapa 1 — Escolher o tipo de destino

Apresentar três opções:

**Google Avaliações**
- Para estabelecimentos que desejam receber avaliações no Google.
- Deve ser a opção padrão.

**Pix**
- Para estabelecimentos que desejam receber pagamentos por aproximação ou QR Code.

**Link personalizado**
- Para direcionar o cliente a qualquer endereço HTTPS, como Instagram, WhatsApp, cardápio digital ou site.

Ao selecionar uma opção, apresentar somente os campos relevantes.

### Etapa 2 — Configurar o destino

#### A. Google Avaliações

Esta é a principal funcionalidade do MVP.

O usuário não deve precisar descobrir manualmente o link de avaliação de sua empresa.

Implementar integração com a **Google Places API (New)**.

Fluxo:

1. Usuário digita o nome do estabelecimento.
2. O sistema pesquisa empresas no Google.
3. Exibe resultados com nome e endereço.
4. Usuário seleciona o estabelecimento correto.
5. O backend consulta os detalhes usando o Place ID.
6. Obtém o link direto para escrever uma avaliação usando `googleMapsLinks.writeAReviewUri`.
7. Apresenta a empresa selecionada e um botão "Testar avaliação".
8. Usuário confirma o estabelecimento e continua.

Requisitos:
- Debounce na pesquisa para evitar requisições excessivas.
- Indicador de carregamento.
- Tratamento de erros e ausência de resultados.
- Não executar buscas com texto insuficiente.
- Permitir alterar o estabelecimento selecionado.
- Disponibilizar "Não encontrou sua empresa? Inserir link manualmente".
- Validar a URL retornada antes de utilizá-la.
- Não exigir autenticação Google do usuário.
- Solicitar somente os campos necessários da API para reduzir custos.
- Não implementar histórico de avaliações, respostas ou analytics nesta etapa.

A integração deve acontecer pelo backend Spring Boot, sem expor a chave da API no frontend. Utilizar variáveis de ambiente para configuração.

Caso a API não esteja configurada, apresentar uma mensagem adequada e manter a opção de cadastro manual.

#### B. Pix

Permitir configurar uma placa para receber pagamentos Pix.

Fluxo:
1. Usuário informa a chave Pix.
2. Informa o nome do recebedor e a cidade, conforme os requisitos do padrão Pix.
3. O sistema valida os dados.
4. Gera um payload Pix estático válido no formato BR Code, com CRC correto.
5. Permite visualizar e copiar o código Pix.
6. O QR Code de pagamento deve ser gerado a partir do payload Pix.

Importante: diferenciar o QR Code de pagamento do QR Code NFC.APP. O primeiro representa a cobrança Pix; o segundo abre a URL pública da placa.

Não utilizar uma URL inventada para representar um pagamento Pix. Caso seja necessário abrir uma página pública de pagamento, implementar uma página simples que apresente o QR Code Pix e o código copia e cola.

Não implementar gateway de pagamento, Pix dinâmico ou integração bancária neste momento.

#### C. Link personalizado

Fluxo:
1. Usuário informa a URL de destino.
2. Sistema valida o endereço.
3. Permite testar a URL em outra aba.
4. Usuário confirma e continua.

Aceitar apenas URLs HTTPS válidas, rejeitando protocolos perigosos e destinos inválidos.

### Etapa 3 — Identificar a placa

Solicitar:

**Nome da placa**
- Campo obrigatório.
- Exemplos: "Balcão principal", "Mesa 01", "Recepção".
- Utilizado somente para organização no dashboard.
- Permitir nomes repetidos, pois um estabelecimento pode ter várias placas com o mesmo destino.

O usuário não precisa informar manualmente um identificador técnico.

### Etapa 4 — Revisar e testar

Antes de publicar, apresentar um resumo:

- Nome da placa.
- Tipo de destino.
- Estabelecimento selecionado ou destino configurado.
- Botão para testar o destino.
- Opção de voltar e editar.

Não criar uma nova página desnecessariamente. Utilizar os componentes existentes.

### Etapa 5 — Publicar a placa

Ao clicar em "Criar placa":

1. Validar todos os dados.
2. Enviar os dados necessários ao backend.
3. Gerar um identificador público único, não sequencial e difícil de adivinhar.
4. Persistir a placa e seu destino no PostgreSQL.
5. Gerar uma URL pública permanente, por exemplo:

`https://nfc.app.br/t/abc123`

6. Retornar os dados da placa publicada.
7. Salvar no localStorage somente as informações necessárias ao gerenciamento local.
8. Exibir uma confirmação de sucesso.

A publicação deve ser idempotente para evitar placas duplicadas em caso de múltiplos cliques ou tentativas após falha de rede.

A URL deve ser construída usando uma configuração de domínio público por ambiente, nunca utilizando `localhost` como endereço de produção.

### Etapa 6 — Placa criada com sucesso

Após publicar, apresentar:

- Nome da placa.
- Tipo de destino.
- URL pública NFC.APP.
- QR Code da URL pública.
- Botão "Copiar link".
- Botão "Baixar QR Code".
- Botão "Testar placa".
- Botão "Voltar para minhas placas".

Apresentar uma orientação simples:

"Grave este link na sua placa NFC utilizando um aplicativo compatível. Depois, aproxime o celular para testar."

Não implementar gravação NFC diretamente pelo navegador nesta etapa.

## 3. Redirecionamento público

Implementar ou adaptar a rota:

`GET /t/{id}`

Comportamento:

1. Receber o identificador público da placa.
2. Consultar o destino ativo no PostgreSQL.
3. Se for Google Avaliações ou Link personalizado, redirecionar para o destino configurado usando um redirecionamento temporário HTTP.
4. Se for Pix, abrir a página pública de pagamento com QR Code e código copia e cola.
5. Se a placa estiver desativada ou não existir, apresentar uma página amigável.

**Regra fundamental:** a URL NFC.APP nunca deve mudar quando o proprietário alterar o destino da placa.

Evitar cache permanente dos redirecionamentos, pois os destinos podem ser atualizados.

## 4. Persistência e autenticação

Preservar a arquitetura atual de uso sem login.

**localStorage**
- Armazenar rascunhos e referências das placas criadas.
- Permitir que o usuário continue gerenciando suas placas no mesmo navegador.
- Reutilizar o serviço e as chaves existentes, sem criar estruturas paralelas.

**Backend e PostgreSQL**
- Armazenar placas publicadas, configurações e destinos.
- Resolver redirecionamentos independentemente do navegador onde a placa foi criada.
- Não depender do localStorage para funcionamento das URLs públicas.

**Segurança**
- Placas anônimas devem possuir credenciais de gerenciamento separadas do identificador público.
- Nunca permitir editar ou excluir uma placa conhecendo apenas sua URL pública.
- Proteger credenciais de gerenciamento e evitar exposição em logs.
- Implementar limites básicos de criação e consulta para evitar abuso das APIs.
- Não aceitar URLs perigosas ou protocolos não permitidos.

**Login opcional**
- Não obrigar cadastro durante a criação.
- Manter a autenticação existente.
- Preparar o fluxo para futura associação das placas anônimas a uma conta autenticada, sem implementar uma nova autenticação.

## 5. Dashboard — Minhas placas

Aproveitar a listagem atual.

Cada placa deve apresentar:

- Nome.
- Tipo de destino.
- URL pública.
- Data de criação ou atualização.
- Situação da placa: ativa ou desativada.

Ações:

**Editar**
- Abrir o formulário existente preenchido.
- Permitir alterar nome, tipo e destino.
- Preservar a URL pública da placa.

**Duplicar**
- Copiar nome e configurações.
- Criar uma nova placa com identificador e URL próprios.
- Não reutilizar o identificador público original.

**Excluir**
- Solicitar confirmação.
- Desativar a placa no backend e removê-la da listagem ativa.
- Não permitir que uma placa excluída continue redirecionando.
- Não reutilizar seu identificador.

**Testar**
- Abrir a URL pública NFC.APP, e não diretamente a URL de destino.

**Copiar**
- Copiar a URL pública da placa.

Reutilizar os cards, botões e notificações já implementados.

## 6. Requisitos técnicos e qualidade

- Reutilizar os serviços Angular e controllers/services/repositories Spring Boot existentes.
- Criar novos componentes somente quando houver necessidade real.
- Reutilizar as entidades e migrações Flyway atuais, adaptando-as quando necessário.
- Não criar tabelas ou abstrações redundantes.
- Manter o código organizado e de fácil manutenção.
- Implementar validação no frontend e backend.
- Tratar estados de carregamento, sucesso e erro.
- Evitar requisições duplicadas.
- Garantir funcionamento em dispositivos móveis.
- Adicionar testes para criação, edição, duplicação, desativação e redirecionamento.
- Não expor chaves de API ou credenciais no frontend.
- Documentar somente as variáveis de ambiente e configurações novas necessárias.

## 7. Critérios de aceite

A implementação estará concluída quando:

1. Um usuário sem login conseguir criar uma placa Google Avaliações pesquisando o estabelecimento.
2. A API retornar e utilizar o link correto para escrever uma avaliação.
3. O usuário conseguir criar placas Pix e Link personalizado.
4. A placa publicada possuir uma URL NFC.APP funcional e permanente.
5. O QR Code abrir a URL pública correspondente.
6. O redirecionamento funcionar em outro dispositivo, independentemente do localStorage.
7. O usuário conseguir editar o destino sem alterar a URL da placa.
8. Duplicar gerar uma placa independente.
9. Desativar impedir novos acessos ao destino.
10. O dashboard continuar seguindo exatamente o padrão visual existente.

## 8. Orientação final

**Não reconstrua o projeto. Evolua o que já está implementado.**

Primeiro, inspecione o código existente e identifique o que pode ser reaproveitado. Depois, implemente o fluxo completo, respeitando a arquitetura e os padrões atuais.

Priorize a experiência do usuário, o funcionamento real das placas e a simplicidade da solução.

Não adicione dashboards de avaliações, IA, assinaturas, planos, relatórios avançados ou outras funcionalidades que não fazem parte deste escopo.