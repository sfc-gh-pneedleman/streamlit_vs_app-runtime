import { ORDERS_TABLE } from '@/lib/constants';
import { snowflake } from '@/lib/snowflake';

export const dynamic = 'force-dynamic';

// Same bounded list as the Streamlit app (top 10,000 orders by price), so the two are comparable.
export async function GET() {
  try {
    const { rows } = await snowflake.query<{ O_ORDERKEY: string }>(
      `SELECT O_ORDERKEY FROM ${ORDERS_TABLE} ORDER BY O_TOTALPRICE DESC LIMIT 10000`,
    );
    return Response.json(rows.map((r) => r.O_ORDERKEY), {
      headers: { 'Cache-Control': 'private, max-age=3600' },
    });
  } catch (e) {
    console.error(new Date().toISOString(), '[order-keys]', e);
    return Response.json({ error: 'Failed to load order keys' }, { status: 500 });
  }
}
