UPDATE plans
SET name = 'Start', price = 0, billing_period = 'NONE'
WHERE code = 'FREE';

UPDATE plans
SET name = 'Pro', price = 29.90, billing_period = 'MONTHLY'
WHERE code = 'PRO';

UPDATE plan_features pf
SET limit_value = CASE p.code
    WHEN 'FREE' THEN 3
    WHEN 'PRO' THEN NULL
END
FROM plans p
WHERE p.id = pf.plan_id
  AND p.code IN ('FREE', 'PRO')
  AND pf.feature_code = 'PUBLISHED_TAGS';
