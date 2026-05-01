-- =====================================================================
-- Seed initial tax_rates row from PRD Appendix §24.
-- Engineering MUST verify against IRAS before each deployment.
-- =====================================================================

insert into tax_rates (
  version,
  effective_from,
  bsd_slabs,
  absd_matrix,
  ltv_rules,
  tdsr,
  msr,
  notes
) values (
  '2026-04-30',
  '2026-04-30',
  -- BSD progressive slabs (PRD §24.1)
  '[
    {"threshold_sgd": 0,        "rate": 0.01},
    {"threshold_sgd": 180000,   "rate": 0.02},
    {"threshold_sgd": 360000,   "rate": 0.03},
    {"threshold_sgd": 1000000,  "rate": 0.04},
    {"threshold_sgd": 1500000,  "rate": 0.05},
    {"threshold_sgd": 3000000,  "rate": 0.06}
  ]'::jsonb,
  -- ABSD matrix (PRD §24.2)
  '[
    {"residency": "citizen",   "property_count": 1, "rate": 0.00},
    {"residency": "citizen",   "property_count": 2, "rate": 0.20},
    {"residency": "citizen",   "property_count": 3, "rate": 0.30},
    {"residency": "pr",        "property_count": 1, "rate": 0.05},
    {"residency": "pr",        "property_count": 2, "rate": 0.30},
    {"residency": "pr",        "property_count": 3, "rate": 0.35},
    {"residency": "foreigner", "property_count": 1, "rate": 0.60},
    {"residency": "foreigner", "property_count": 2, "rate": 0.60},
    {"residency": "foreigner", "property_count": 3, "rate": 0.60},
    {"residency": "company",   "property_count": 1, "rate": 0.65},
    {"residency": "company",   "property_count": 2, "rate": 0.65},
    {"residency": "company",   "property_count": 3, "rate": 0.65}
  ]'::jsonb,
  -- LTV rules (PRD §24.3)
  '[
    {"scenario": "first_loan_normal",      "ltv_cap": 0.75},
    {"scenario": "first_loan_extended",    "ltv_cap": 0.55},
    {"scenario": "second_loan_normal",     "ltv_cap": 0.45},
    {"scenario": "second_loan_extended",   "ltv_cap": 0.25},
    {"scenario": "third_plus_loan",        "ltv_cap": 0.15}
  ]'::jsonb,
  -- TDSR (PRD §24.4)
  '{"cap": 0.55, "stress_rate": 0.04}'::jsonb,
  -- MSR (PRD §24.5)
  '{"cap": 0.30}'::jsonb,
  'Initial seed from PRD Appendix §24. Verify against IRAS before launch.'
);
