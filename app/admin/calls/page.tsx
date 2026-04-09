import { AdminCallsLive } from '@/components/admin/admin-calls-live';

export const metadata = {
  title: 'Calls and incidents.',
};

export default async function AdminCallsPage(props: {
  searchParams?: Promise<{
    shopId?: string;
  }>;
}) {
  const searchParams = await props.searchParams;
  return <AdminCallsLive initialShopId={searchParams?.shopId ?? null} />;
}
