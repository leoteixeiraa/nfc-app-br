## Infraestrutura e arquitetura
- [ X ] INF-01 Validar Docker Compose: Angular/Caddy, Spring Boot e PostgreSQL
- [ ] INF-02 Configurar variáveis por ambiente e gestão de segredos
- [ ] INF-03 Configurar Flyway e migrações iniciais
- [ ] INF-04 Configurar ambientes local e produção
- [ ] INF-05 Criar health checks e logs estruturados
- [ ] INF-06 Configurar HTTPS, domínio e proxy reverso

## Autenticação e usuários
- [x] AUT-01 Criar cadastro somente com Google (sem cadastro com e-mail e senha)
- [x] AUT-02 Implementar login e logout seguros somente com Google
- [x] AUT-05 Criar endpoint /me e sessão autenticada
- [x] AUT-06 Implementar guards e interceptors Angular

## Organizações e planos
- [ ] ORG-01 Criar organização automaticamente no cadastro
- [ ] ORG-02 Vincular usuário à organização como proprietário
- [ ] ORG-03 Criar planos Free, Pro e Business no banco
- [ ] ORG-04 Implementar assinatura inicial Free com limite de 3 placas
- [ ] ORG-05 Validar limites e permissões no backend
- [ ] ORG-06 Implementar isolamento de dados entre organizações

## Gerenciamento de placas
- [ ] NFC-01 Criar endpoint para cadastrar placa virtual
- [ ] NFC-02 Gerar identificador público único e não sequencial
- [ ] NFC-03 Listar placas com paginação e busca simples
- [ ] NFC-04 Editar nome e destino da placa
- [ ] NFC-05 Desativar e reativar placa
- [ ] NFC-06 Criar tela de detalhes com URL pública e ações

## Redirecionamentos
- [ ] RED-01 Criar endpoint público GET /t/{codigo}
- [ ] RED-02 Configurar destino HTTPS validado
- [ ] RED-03 Implementar redirecionamento HTTP 302 sem cache prolongado
- [ ] RED-04 Tratar placa inexistente, desativada ou sem destino
- [ ] RED-05 Registrar eventos de acesso sem bloquear o redirecionamento

## QR Code e NFC
- [ ] QRC-01 Gerar QR Code da URL permanente da placa
- [ ] QRC-02 Permitir download do QR Code em PNG
- [ ] QRC-03 Criar ação de copiar link público
- [ ] QRC-04 Criar tutorial de gravação NFC em Android e iPhone

## Dashboard e estatísticas
- [ ] DAS-01 Criar cards de total de placas e acessos
- [ ] DAS-02 Exibir acessos dos últimos 7 dias
- [ ] DAS-03 Exibir contagem de acessos por placa
- [ ] DAS-04 Criar estado vazio e onboarding da primeira placa
- [ ] DAS-05 Criar feedback visual de erros, loading e sucesso

## Site público e aquisição
- [ ] WEB-01 Criar landing page responsiva com proposta de valor
- [ ] WEB-02 Criar CTA Começar grátis e demonstração do fluxo
- [ ] WEB-03 Criar página Como funciona e FAQ
- [ ] WEB-04 Criar páginas de Termos de Uso e Privacidade
- [ ] WEB-05 Adicionar canal de contato e feedback
- [ ] WEB-06 Configurar SEO básico e metadados sociais

## Segurança e qualidade
- [ ] SEG-01 Implementar rate limiting em login, cadastro e redirecionamentos
- [ ] SEG-02 Proteger redirecionamentos contra destinos perigosos e abuso
- [ ] SEG-03 Criar testes de autenticação e isolamento multi-tenant
- [ ] SEG-04 Criar testes de regras de planos e ciclo de vida das placas
- [ ] SEG-05 Validar acessibilidade e responsividade mobile
- [ ] SEG-06 Implementar política de retenção e exclusão de dados

## Publicação e operação
- [ ] OPS-01 Configurar CI/CD com testes e build
- [ ] OPS-02 Configurar backup automático do PostgreSQL e testar restauração
- [ ] OPS-03 Configurar monitoramento de disponibilidade e erros
- [ ] OPS-04 Realizar testes ponta a ponta com placas NFC físicas
- [ ] OPS-05 Executar checklist de produção e lançamento público


------------------


## BACKLOG FRONT

Arquitetura e limpeza do template
FE-ARC · 0/6 concluídas
P0

[ ] Auditar estrutura, dependências, layouts e componentes do template

[ ] Remover páginas de demonstração e funcionalidades não utilizadas

[ ] Definir estrutura feature-based com core, shared, layouts e features

[ ] Configurar lazy loading e rotas públicas, privadas e de autenticação

[ ] Organizar environments, configuração de API e build de produção

[ ] Definir convenções de nomes, tipagem, lint e formatação



Design system e identidade NFC.APP
FE-DS · 0/6 concluídas
P0

[ ] Aplicar logo, cores, tipografia, favicon e identidade visual

[ ] Definir tokens de espaçamento, cores, bordas e tipografia

[ ] Padronizar botões, inputs, selects, tabelas, modais e cards

[ ] Padronizar estados loading, empty, error e success

[ ] Criar componentes de feedback, confirmação e notificações

[ ] Garantir contraste, navegação por teclado e responsividade



Layouts e navegação
FE-LAY · 0/6 concluídas
P0

[ ] Adaptar sidebar com navegação específica do NFC.APP

[ ] Adaptar header com usuário, organização e menu de conta

[ ] Criar layout público independente do dashboard

[ ] Criar layout de autenticação com apresentação consistente

[ ] Implementar menu mobile e navegação responsiva

[ ] Criar páginas 403, 404 e erro genérico



Autenticação
FE-AUT · 4/4 concluídas
P0

[x] Criar telas de cadastro e login somente com Google

[x] Implementar AuthService e gerenciamento seguro de sessão

[x] Implementar guards e tratamento de sessão expirada

[x] Criar logout e redirecionamento após autenticação



Gestão de placas NFC
FE-NFC · 0/6 concluídas
P0

[ ] Criar listagem de placas com busca, paginação e estados vazios

[ ] Criar formulário de cadastro de placa

[ ] Criar tela de detalhes e edição de placa

[ ] Implementar seletor de destino e validação de URL

[ ] Implementar ativação e desativação com confirmação

[ ] Exibir limite de placas conforme plano e bloquear novas criações



QR Code e experiência NFC
FE-QR · 0/5 concluídas
P0

[ ] Exibir URL pública permanente e ação de copiar

[ ] Gerar QR Code a partir da URL pública

[ ] Permitir download do QR Code em PNG

[ ] Criar instruções de gravação NFC e teste da placa

[ ] Criar pré-visualização do destino configurado



Dashboard e analytics
FE-DAS · 0/5 concluídas
P1

[ ] Criar cards com quantidade de placas e acessos

[ ] Criar gráfico de acessos dos últimos sete dias

[ ] Criar resumo de acessos por placa

[ ] Criar onboarding para usuários sem placas

[ ] Implementar filtros simples e atualização dos indicadores



Site público e aquisição
FE-PUB · 0/6 concluídas
P0

[ ] Criar landing page com hero, benefícios e CTA

[ ] Criar seção Como funciona com fluxo em três passos

[ ] Criar seção de casos de uso: Google, Pix, WhatsApp e links

[ ] Criar FAQ e apresentação do plano gratuito

[ ] Criar páginas de termos, privacidade e contato

[ ] Configurar títulos, descrições, Open Graph e SEO básico



Conta e organização
FE-ACC · 0/4 concluídas
P1

[ ] Criar tela de perfil e atualização de dados

[ ] Criar tela de organização com dados básicos

[ ] Criar visualização do plano atual e limites de utilização

[ ] Preparar interface para funcionalidades futuras sem exibir recursos indisponíveis



Integração, testes e entrega
FE-QUA · 0/6 concluídas
P0

[ ] Criar camada HTTP tipada com tratamento centralizado de erros

[ ] Padronizar formulários reativos e mensagens de validação

[ ] Criar testes unitários de serviços e regras de interface

[ ] Criar testes E2E do cadastro até a criação da placa

[ ] Validar experiência mobile, performance e acessibilidade

[ ] Configurar build de produção e integração com Caddy
