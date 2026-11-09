# Planos e assinaturas: consultas e alteração no banco

Este guia reúne consultas PostgreSQL e o procedimento administrativo para
consultar ou alterar o plano de uma organização. Execute os comandos no banco
correto, por exemplo, usando o editor SQL do DBeaver.

## Como os dados se relacionam

O plano pertence à **organização**, não diretamente ao usuário. Por isso, um
`SELECT * FROM users` não mostra o plano.

| Tabela | Finalidade |
|---|---|
| `users` | Contas de usuários. |
| `organization_memberships` | Vínculos entre usuários e organizações. |
| `organizations` | Organizações, incluindo organizações pessoais. |
| `organization_subscriptions` | Assinaturas e histórico por organização. |
| `plans` | Catálogo de planos. |
| `plan_features` | Capacidades e limites de cada plano. |

O caminho é `users` → `organization_memberships` → `organizations` →
`organization_subscriptions` → `plans`. Uma alteração de plano afeta todos os
usuários da organização. Um usuário pode pertencer a mais de uma organização;
atualmente, a aplicação usa o vínculo mais antigo como organização corrente,
desempatando pelo ID da organização.

## 1. Confirmar a migration

Confira se a versão 8 foi aplicada com sucesso ao banco conectado:

```sql
SELECT version, description, success
FROM flyway_schema_history
ORDER BY installed_rank DESC;
```

Procure a versão `9`, com `success = true`. A versão 8 cria as tabelas de planos
e assinaturas; a versão 9 atualiza o catálogo Start/Pro e o limite de placas.
A migration Flyway é aplicada ao iniciar o backend atualizado; não execute seu
conteúdo manualmente nem altere o histórico do Flyway. Em caso de erro,
verifique os logs do backend.

## 2. Consultar os planos cadastrados

```sql
SELECT code, name, price, billing_period, active
FROM plans
ORDER BY price, code;
```

Os dados iniciais cadastrados pela migration são:

| Código | Nome | Preço inicial | Período | Limite de placas publicadas |
|---|---|---:|---|---:|
| `FREE` | Start | R$ 0,00 | Sem cobrança | 3 |
| `PRO` | Pro | R$ 29,90 | Mensal | Sem limite numérico |

Para `PUBLISHED_TAGS`, `limit_value = NULL` em uma funcionalidade habilitada
significa que não há limite numérico. A API sinaliza esse estado com
`unlimited: true`; uma funcionalidade desabilitada permanece com `enabled: false`
e não deve ser interpretada como ilimitada.

O preço e a situação podem ser alterados posteriormente no catálogo; a consulta
mostra os valores atuais. Para listar somente planos ativos, acrescente
`WHERE active = true` antes de `ORDER BY`. A API também disponibiliza o
catálogo ativo em `GET /api/plans`.

Para consultar capacidades e limites de cada plano:

```sql
SELECT
    p.code,
    p.name,
    f.feature_code,
    f.enabled AS previsto_no_plano,
    f.available AS disponivel_no_produto,
    f.limit_value
FROM plans p
JOIN plan_features f ON f.plan_id = p.id
ORDER BY p.code, f.feature_code;
```

Uma capacidade só é considerada habilitada quando está prevista no plano
(`enabled`) **e** disponível no produto (`available`), além de a assinatura
estar válida. Recursos futuros do Pro podem estar previstos sem estarem
disponíveis. Não altere esses indicadores apenas para simular funcionalidades
ainda não implementadas.

## 3. Identificar a organização e o plano de um usuário

Substitua `EMAIL_DO_USUARIO` pelo e-mail procurado, mantendo as aspas:

```sql
SELECT
    u.email,
    o.id AS organization_id,
    o.name AS organizacao,
    p.code AS plano,
    s.status,
    s.started_at AS inicio,
    s.expires_at AS vencimento
FROM users u
JOIN organization_memberships m ON m.user_id = u.id
JOIN organizations o ON o.id = m.organization_id
LEFT JOIN organization_subscriptions s
    ON s.organization_id = o.id AND s.status = 'ACTIVE'
LEFT JOIN plans p ON p.id = s.plan_id
WHERE lower(u.email) = lower('EMAIL_DO_USUARIO')
ORDER BY m.created_at, o.id;
```

Confira o `organization_id` da linha correta antes de fazer qualquer alteração.
Se o usuário tiver mais de uma linha, a primeira corresponde à organização
corrente usada pela aplicação. A ausência de uma assinatura ativa aparece com
`plano` e `status` nulos. `ACTIVE` não garante que uma assinatura com
`expires_at` preenchido ainda esteja dentro do prazo.

Para listar assinaturas ativas de todos os usuários:

```sql
SELECT
    u.email,
    o.name AS organizacao,
    p.code AS codigo_plano,
    p.name AS plano,
    s.status,
    s.started_at AS inicio,
    s.expires_at AS vencimento
FROM users u
JOIN organization_memberships m ON m.user_id = u.id
JOIN organizations o ON o.id = m.organization_id
JOIN organization_subscriptions s ON s.organization_id = o.id
JOIN plans p ON p.id = s.plan_id
WHERE s.status = 'ACTIVE'
ORDER BY u.email, o.name;
```

## 4. Alterar o plano de uma organização

**Atenção:** esta é uma operação administrativa que grava no banco. Confirme o
ambiente e a organização, verifique se há backup adequado e obtenha autorização
antes de executá-la. Não compartilhe identificadores, e-mails ou credenciais
reais em exemplos públicos.

1. Execute a consulta da seção 3 e copie o `organization_id` correto.
2. No bloco abaixo, substitua `ID_DA_ORGANIZACAO` pelo UUID copiado, mantendo
   as aspas. Informe `PRO` para upgrade ou `FREE` para downgrade.
3. Execute **o bloco completo**, não apenas o `UPDATE` ou o `INSERT`.

```sql
DO $$
DECLARE
    v_organization_id uuid := 'ID_DA_ORGANIZACAO';
    v_plan_code text := 'PRO';
    v_plan_id uuid;
    v_current_plan_id uuid;
BEGIN
    -- Usa o mesmo bloqueio por organização das publicações do backend.
    PERFORM id
    FROM organizations
    WHERE id = v_organization_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Organização não encontrada';
    END IF;

    SELECT id INTO v_plan_id
    FROM plans
    WHERE code = v_plan_code AND active = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Plano ativo não encontrado: %', v_plan_code;
    END IF;

    SELECT plan_id INTO v_current_plan_id
    FROM organization_subscriptions
    WHERE organization_id = v_organization_id AND status = 'ACTIVE';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Organização sem assinatura ativa; verifique antes de continuar';
    END IF;

    IF v_current_plan_id = v_plan_id THEN
        RAISE EXCEPTION 'A organização já possui uma assinatura ACTIVE desse plano; nenhuma alteração realizada';
    END IF;

    UPDATE organization_subscriptions
    SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
    WHERE organization_id = v_organization_id
      AND status = 'ACTIVE';

    INSERT INTO organization_subscriptions (organization_id, plan_id, status)
    VALUES (v_organization_id, v_plan_id, 'ACTIVE');
END $$;
```

O bloco é atômico: se ocorrer um erro, suas alterações são revertidas. Se o
editor estiver com **autocommit desativado**, confirme a transação com
`COMMIT` após o sucesso, ou use `ROLLBACK` para descartá-la. Uma assinatura
anterior passa a `CANCELLED` e permanece no histórico; a nova começa como
`ACTIVE`, sem vencimento. O bloco rejeita uma nova execução para o mesmo plano,
inclusive quando a assinatura ativa já estiver vencida; nesse caso, investigue
antes de intervir.

Uma mudança direta no banco **não gera cobrança**, checkout, renovação ou
pagamento. A criação do Pro no catálogo não significa que essas integrações
estejam disponíveis.

## 5. Confirmar o resultado e consultar o histórico

Repita a consulta da seção 3 e verifique o plano e o status `ACTIVE`. Para ver
também assinaturas anteriores, substitua o UUID abaixo:

```sql
SELECT
    p.code AS plano,
    p.name,
    s.status,
    s.started_at AS inicio,
    s.expires_at AS vencimento,
    s.created_at AS criada_em,
    s.updated_at AS atualizada_em
FROM organization_subscriptions s
JOIN plans p ON p.id = s.plan_id
WHERE s.organization_id = 'ID_DA_ORGANIZACAO'::uuid
ORDER BY s.created_at DESC, s.id DESC;
```

Após um upgrade de FREE para PRO, normalmente haverá uma assinatura PRO
`ACTIVE` e a anterior FREE `CANCELLED`. Não apague o histórico.
O avatar e o menu identificam os códigos `FREE` e `PRO` como **Free** e
**Plus**, respectivamente; os nomes do catálogo continuam Start e Pro. A
identificação é exibida somente para uma assinatura ativa e não vencida. Em
caso de falha, o menu informa que o plano está indisponível, sem presumir um
plano. O aplicativo reconsulta ao navegar ou retornar à janela. Uma futura
ação de alteração de assinatura deve chamar `CurrentPlanService.refresh()`
após a confirmação do backend para atualizar o indicador imediatamente.

## 6. Consultar consumo de placas

O consumo considera placas da organização com um link ativo. Substitua o UUID:

```sql
SELECT count(*) AS placas_publicadas
FROM nfc_tags t
WHERE t.organization_id = 'ID_DA_ORGANIZACAO'::uuid
  AND EXISTS (
      SELECT 1
      FROM redirect_links l
      WHERE l.nfc_tag_id = t.id AND l.is_active
  );
```

O FREE permite até 3 placas publicadas e o PRO até 100, conforme os limites
configurados em `plan_features`. Em um downgrade, placas já publicadas e seus
redirecionamentos são preservados. Se o consumo for igual ou superior ao novo
limite, novas publicações e reativações serão bloqueadas até haver uma vaga;
edições de placas já ativas continuam permitidas.

## Cadastro e organizações existentes

Novos usuários recebem uma organização pessoal e uma assinatura FREE na mesma
transação de cadastro. O login de uma conta existente não deve criar novas
organizações ou assinaturas. A migration V8 cria organizações pessoais para
usuários sem vínculo e atribui FREE às organizações existentes, preservando
os dados; o Flyway registra a execução para não reaplicá-la em cada início.
