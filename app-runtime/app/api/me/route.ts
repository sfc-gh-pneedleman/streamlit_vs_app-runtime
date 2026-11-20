import { getViewer } from '@/lib/viewer';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return Response.json(await getViewer());
  } catch (e) {
    console.error(new Date().toISOString(), '[me]', e);
    return Response.json({ error: 'Failed to identify viewer' }, { status: 500 });
  }
}
