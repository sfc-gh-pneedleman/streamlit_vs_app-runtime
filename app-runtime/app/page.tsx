import { OrderReview } from '@/components/order-review';
import { PageHeader } from '@/components/page-header';

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <PageHeader title="Order review" description="Explore orders, flag one with a reason, and review recent flags." />
      <OrderReview />
    </main>
  );
}
