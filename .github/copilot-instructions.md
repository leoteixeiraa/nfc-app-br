# NFC.APP — instruções do workspace

## Requisitos do projeto
- Monorepo em português brasileiro: Angular 21 no frontend e Java 21/Spring Boot 3.x no backend.
- Manter o backend como monólito modular, sem antecipar módulos ou regras de negócio.
- Usar migrations Flyway para mudanças de esquema; nunca habilitar `ddl-auto=update`.
- Preferir caminhos relativos `/api` no frontend e configuração por variáveis de ambiente.
- Manter PostgreSQL e backend sem portas públicas; Caddy é a única entrada externa.
- Não adicionar Firebase, Kubernetes, brokers, Redis ou serviços proprietários.

## Checklist de fundação
- [x] Requisitos e tecnologias definidos.
- [x] Projeto Angular e Spring Boot scaffoldados.
- [x] Infraestrutura Docker e Caddy configurada.
- [x] CI, documentação e operações iniciais adicionadas.
- [ ] Validar build, testes e Compose no ambiente local.

## Convenções
- Não adicionar funcionalidades de negócio nesta etapa.
- Manter dependências ao mínimo e usar versões explícitas em imagens Docker.
- Não versionar `.env`, credenciais, dumps ou dados locais.
- Atualizar README apenas quando o comportamento operacional do projeto mudar.
