## Infraestrutura e arquitetura
- [ X ] INF-01 Validar Docker Compose: Angular/Caddy, Spring Boot e PostgreSQL
- [ ] INF-02 Configurar variáveis por ambiente e gestão de segredos
- [ ] INF-03 Configurar Flyway e migrações iniciais
- [ ] INF-04 Configurar ambientes local e produção
- [ ] INF-05 Criar health checks e logs estruturados
- [ ] INF-06 Configurar HTTPS, domínio e proxy reverso

## Autenticação e usuários
- [ ] AUT-01 Criar cadastro com e-mail e senha
- [ ] AUT-02 Implementar login e logout seguros
- [ ] AUT-03 Implementar confirmação de e-mail
- [ ] AUT-04 Implementar recuperação de senha
- [ ] AUT-05 Criar endpoint /me e sessão autenticada
- [ ] AUT-06 Implementar guards e interceptors Angular

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