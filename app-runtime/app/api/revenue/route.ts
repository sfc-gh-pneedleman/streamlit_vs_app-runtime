import { ORDERS_TABLE, PRIORITIES, STATUSES } from '@/lib/constants';
import { snowflake } from '@/lib/snowflake';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const priority = params.get('priority') ?? 'All';
  const status = params.get('status') ?? 'All';
  if (!PRIORITIES.includes(priority) || !STATUSES.includes(status)) {
    return Response.json({ error: 'Invalid filter' }, { status: 400 });
  }
  try {
    const { rows } = await snowflake.query(
      `SELECT TO_VARCHAR(DATE_TRUNC('month', O_ORDERDATE), 'YYYY-MM') AS MONTH, SUM(O_TOTALPRICE) AS REVENUE
       FROM ${ORDERS_TABLE}
       WHERE (? = 'All' OR O_ORDERPRIORITY = ?) AND (? = 'All' OR O_ORDERSTATUS = ?)
       GROUP BY 1 ORDER BY 1`,
      { binds: [priority, priority, status, status] },
    );
    return Response.json(rows);
  } catch (e) {
    console.error(new Date().toISOString(), '[revenue]', e);
    return Response.json({ error: 'Failed to load revenue' }, { status: 500 });
  }
}
