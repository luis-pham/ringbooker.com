CREATE TABLE IF NOT EXISTS public.business_knowledge_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  source_url text NOT NULL,
  suggestion_type text NOT NULL CHECK (suggestion_type IN ('staff', 'policy', 'faq', 'promotion', 'booking_hint')),
  payload_json jsonb NOT NULL,
  payload_hash text NOT NULL,
  confidence double precision NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
  source text NOT NULL CHECK (source IN ('website', 'llm', 'jsonld', 'deterministic')),
  evidence_snippet text NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz NULL,
  dismissed_at timestamptz NULL,
  CONSTRAINT business_knowledge_suggestions_payload_size CHECK (octet_length(payload_json::text) <= 20000),
  CONSTRAINT business_knowledge_suggestions_evidence_size CHECK (evidence_snippet IS NULL OR char_length(evidence_snippet) <= 500)
);

CREATE INDEX IF NOT EXISTS idx_business_knowledge_suggestions_shop_status
  ON public.business_knowledge_suggestions(shop_id, status);

CREATE INDEX IF NOT EXISTS idx_business_knowledge_suggestions_shop_type
  ON public.business_knowledge_suggestions(shop_id, suggestion_type);

CREATE INDEX IF NOT EXISTS idx_business_knowledge_suggestions_source_url
  ON public.business_knowledge_suggestions(source_url);

CREATE INDEX IF NOT EXISTS idx_business_knowledge_suggestions_created_at
  ON public.business_knowledge_suggestions(created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_business_knowledge_suggestions_pending_dedupe
  ON public.business_knowledge_suggestions(shop_id, source_url, suggestion_type, payload_hash)
  WHERE status = 'pending';
