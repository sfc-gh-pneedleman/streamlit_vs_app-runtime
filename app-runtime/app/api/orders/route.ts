import { ORDERS_TABLE, PRIORITIES, STATUSES } from '@/lib/constants';
import { snowflake } from '@/lib/snowflake';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const priority = params.get('priority') ?? 'All';
  const status = params.get('status') ?? 'All';
  const month = params.get('month') ?? '';
  if (!PRIORITIES.includes(priority) || !STATUSES.includes(status) || (month && !/^\d{4}-\d{2}$/.test(month))) {
    return Response.json({ error: 'Invalid filter' }, { status: 400 });
  }
  try {
    const { rows } = await snowflake.query(
      `SELECT O_ORDERKEY, O_CUSTKEY, O_ORDERSTATUS, O_TOTALPRICE, O_ORDERDATE, O_ORDERPRIORITY
       FROM ${ORDERS_TABLE}
       WHERE (? = 'All' OR O_ORDERPRIORITY = ?) AND (? = 'All' OR O_ORDERSTATUS = ?)
         AND (? = '' OR TO_VARCHAR(DATE_TRUNC('month', O_ORDERDATE), 'YYYY-MM') = ?)
       ORDER BY O_TOTALPRICE DESC LIMIT 200`,
      { binds: [priority, priority, status, status, month, month] },
    );
    return Response.json(rows);
  } catch (e) {
    console.error(new Date().toISOString(), '[orders]', e);
    return Response.json({ error: 'Failed to load orders' }, { status: 500 });
  }
}
