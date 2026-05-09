import { PaddleCheckoutClient } from '@/components/billing/paddle-checkout-client';

export const metadata = {
  title: 'Secure checkout - RingBooker',
};

type SearchParamValue = string | string[] | undefined;

function firstParam(value: SearchParamValue): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default async function PaddleCheckoutPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, SearchParamValue>>;
}) {
  const resolvedSearchParams = await searchParams;
  const transactionId =
    firstParam(resolvedSearchParams?._ptxn) ||
    firstParam(resolvedSearchParams?.txn) ||
    firstParam(resolvedSearchParams?.transaction_id);
  const paddleEnv = process.env.PADDLE_ENV ?? process.env.PADDLE_ENVIRONMENT ?? 'sandbox';
  const environment = paddleEnv === 'production' ? 'production' : 'sandbox';

  return (
    <PaddleCheckoutClient
      clientToken={process.env.PADDLE_CLIENT_TOKEN ?? ''}
      environment={environment}
      transactionId={transactionId}
    />
  );
}
