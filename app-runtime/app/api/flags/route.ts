import { FLAGS_TABLE, ORDERS_TABLE, SOURCE_APP } from '@/lib/constants';
import { asCaller, snowflake } from '@/lib/snowflake';
import { getViewer } from '@/lib/viewer';

export const dynamic = 'force-dynamic';

// History runs as the signed-in viewer (restricted caller's rights), so the masking policy
// evaluates against the viewer's role. Writes below stay with the owner.
export async function GET() {
  try {
    const caller = await asCaller();
    const { rows: roleRows } = await caller.query<{ R: string }>('SELECT CURRENT_ROLE() AS R');
    const { rows } = await caller.query(
      `SELECT ORDER_KEY, REASON, FLAGGED_BY, FLAGGED_BY_EMAIL, SOURCE_APP, CREATED_AT
       FROM ${FLAGS_TABLE} ORDER BY CREATED_AT DESC LIMIT 10`,
    );
    return Response.json({ role: roleRows[0].R, rows });
  } catch (e) {
    console.error(new Date().toISOString(), '[flags:get]', e);
    return Response.json(
      { error: 'Could not read History as the signed-in user. Caller grants may be missing.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let body: { orderKey?: unknown; reason?: unknown; confirmed?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const orderKey = String(body.orderKey ?? '').trim();
  const reason = String(body.reason ?? '').trim();
  if (!/^\d+$/.test(orderKey)) return Response.json({ error: 'Enter a numeric order key.' }, { status: 400 });
  if (!reason) return Response.json({ error: 'Reason is required.' }, { status: 400 });
  if (reason.length > 500) return Response.json({ error: 'Reason is limited to 500 characters.' }, { status: 400 });
  if (body.confirmed !== true) return Response.json({ error: 'Please confirm before submitting.' }, { status: 400 });

  try {
    const viewer = await getViewer();
    // Inserts only when the order exists, in one statement.
    const { rows } = await snowflake.query<Record<string, string>>(
      `INSERT INTO ${FLAGS_TABLE} (ORDER_KEY, REASON, FLAGGED_BY, SOURCE_APP, FLAGGED_BY_EMAIL)
       SELECT O_ORDERKEY, ?, ?, ?, ? FROM ${ORDERS_TABLE} WHERE O_ORDERKEY = ?`,
      { binds: [reason, viewer.userName, SOURCE_APP, viewer.email, orderKey] },
    );
    const inserted = Number(Object.values(rows[0] ?? {})[0] ?? 0);
    if (inserted === 0) return Response.json({ error: `Order ${orderKey} does not exist.` }, { status: 404 });
    return Response.json({ ok: true, orderKey });
  } catch (e) {
    console.error(new Date().toISOString(), '[flags:post]', e);
    return Response.json({ error: 'Failed to save the flag.' }, { status: 500 });
  }
}
