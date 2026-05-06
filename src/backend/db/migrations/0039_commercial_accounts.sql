-- Enterprise / Custom commercial contract and billing terms.

CREATE TABLE IF NOT EXISTS public.commercial_accounts (
  shop_id UUID PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  contract_status TEXT NOT NULL DEFAULT 'draft' CHECK (contract_status IN ('draft','sent','signed','active','paused','terminated')),
  monthly_minimum_cents INTEGER,
  setup_fee_cents INTEGER,
  included_locations INTEGER,
  included_minutes INTEGER,
  overage_rate_cents INTEGER,
  billing_method TEXT NOT NULL DEFAULT 'manual_invoice' CHECK (billing_method IN ('manual_invoice','paddle_custom','wire','ach','other')),
  contract_signed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commercial_accounts_contract_status
  ON public.commercial_accounts (contract_status, updated_at DESC);
