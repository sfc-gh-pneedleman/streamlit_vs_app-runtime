'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CHART_COLORS, CHART_THEME } from '@/components/chart-utils';
import { PRIORITIES, STATUSES } from '@/lib/constants';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { CartesianGrid, Cell, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Row = Record<string, string | null>;
const TABS = ['Explore', 'Flag an order', 'History'] as const;

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? 'Request failed');
  return data as T;
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <select className="h-9 rounded-md border bg-background px-2" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

function Explore() {
  const [priority, setPriority] = useState('All');
  const [status, setStatus] = useState('All');
  const [month, setMonth] = useState('');
  const [selected, setSelected] = useState<Row | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const qs = new URLSearchParams({ priority, status }).toString();
  const ordersQs = new URLSearchParams({ priority, status, month }).toString();
  const revenue = useQuery({ queryKey: ['revenue', qs], queryFn: () => getJson<Row[]>(`/api/revenue?${qs}`) });
  const orders = useQuery({ queryKey: ['orders', ordersQs], queryFn: () => getJson<Row[]>(`/api/orders?${ordersQs}`) });
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    let rows = orders.data ?? [];
    if (term) rows = rows.filter((o) => Object.values(o).some((v) => (v ?? '').toLowerCase().includes(term)));
    if (sort) {
      const { key, dir } = sort;
      rows = [...rows].sort((a, b) => {
        const x = a[key] ?? '';
        const y = b[key] ?? '';
        const nx = Number(x);
        const ny = Number(y);
        return (Number.isNaN(nx) || Number.isNaN(ny) ? x.localeCompare(y) : nx - ny) * dir;
      });
    }
    return rows;
  }, [orders.data, search, sort]);
  const header = (key: string, label: string, numeric = false) => (
    <TableHead numeric={numeric} className="cursor-pointer select-none" onClick={() => setSort((s) => (s?.key === key ? (s.dir === 1 ? { key, dir: -1 } : null) : { key, dir: 1 }))}>
      {label}{sort?.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
    </TableHead>
  );
  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Select label="Order priority" value={priority} options={PRIORITIES} onChange={setPriority} />
        <Select label="Order status" value={status} options={STATUSES} onChange={setStatus} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Revenue by month</CardTitle>
          <p className="text-sm text-muted-foreground">Click a month to filter the orders below. Click again to clear.</p>
        </CardHeader>
        <CardContent className="h-72">
          {revenue.error ? (
            <Alert variant="destructive"><AlertDescription>{(revenue.error as Error).message}</AlertDescription></Alert>
          ) : revenue.isPending ? (
            'Loading…'
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={revenue.data.map((r) => ({ month: r.MONTH, revenue: Number(r.REVENUE) }))}
                onClick={(state) => {
                  const clicked = state?.activeLabel ? String(state.activeLabel) : '';
                  setMonth((m) => (clicked && clicked !== m ? clicked : ''));
                }}
              >
                <CartesianGrid stroke={CHART_THEME.grid} strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: CHART_THEME.axis, fontSize: 12 }} minTickGap={40} />
                <YAxis tick={{ fill: CHART_THEME.axis, fontSize: 12 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} width={48} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Bar dataKey="revenue" className="cursor-pointer">
                  {revenue.data.map((r) => (
                    <Cell key={r.MONTH} fill={CHART_COLORS[0]} fillOpacity={!month || r.MONTH === month ? 1 : 0.35} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{month ? `Top 200 orders by price in ${month}` : 'Top 200 orders by price'}</CardTitle>
          <p className="text-sm text-muted-foreground">Click a row for details, a header to sort. Search filters as you type, in the browser.</p>
          <input
            className="mt-2 h-9 w-72 rounded-md border bg-background px-2 text-sm"
            placeholder="Search these orders"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">{orders.data ? `${visible.length} of ${orders.data.length} rows` : ''}</p>
        </CardHeader>
        <CardContent className="p-0">
          {orders.error ? (
            <Alert variant="destructive"><AlertDescription>{(orders.error as Error).message}</AlertDescription></Alert>
          ) : orders.isPending ? (
            <p className="p-4 text-sm">Loading…</p>
          ) : (
            <div className="max-h-96 overflow-auto">
              <Table striped>
                <TableHeader>
                  <TableRow>
                    {header('O_ORDERKEY', 'Order key')}
                    {header('O_CUSTKEY', 'Customer')}
                    {header('O_ORDERSTATUS', 'Status')}
                    {header('O_TOTALPRICE', 'Total price', true)}
                    {header('O_ORDERDATE', 'Date')}
                    {header('O_ORDERPRIORITY', 'Priority')}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((o) => (
                    <TableRow key={o.O_ORDERKEY} className="cursor-pointer" onClick={() => setSelected(o)}>
                      <TableCell>{o.O_ORDERKEY}</TableCell>
                      <TableCell>{o.O_CUSTKEY}</TableCell>
                      <TableCell>{o.O_ORDERSTATUS}</TableCell>
                      <TableCell numeric>{formatCurrency(o.O_TOTALPRICE)}</TableCell>
                      <TableCell>{formatDate(o.O_ORDERDATE)}</TableCell>
                      <TableCell>{o.O_ORDERPRIORITY}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Order {selected?.O_ORDERKEY}</DialogTitle>
            <DialogDescription>To flag this order, use the Flag an order tab.</DialogDescription>
          </DialogHeader>
          <dl className="space-y-2 text-sm">
            {selected &&
              Object.entries(selected).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="font-medium">{k}</dt>
                  <dd className="text-muted-foreground">{v ?? '—'}</dd>
                </div>
              ))}
          </dl>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Flag() {
  const queryClient = useQueryClient();
  const keys = useQuery({ queryKey: ['order-keys'], queryFn: () => getJson<string[]>('/api/order-keys'), staleTime: Infinity });
  const me = useQuery({ queryKey: ['me'], queryFn: () => getJson<{ userName: string; email: string | null }>('/api/me'), staleTime: Infinity });
  const [orderKey, setOrderKey] = useState('');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const r = await fetch('/api/flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderKey, reason, confirmed }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'Request failed');
      setMessage({ kind: 'ok', text: `Order ${orderKey} flagged.` });
      setOrderKey('');
      setReason('');
      setConfirmed(false);
      queryClient.invalidateQueries({ queryKey: ['history'] });
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardContent className="pt-6">
        <form onSubmit={submit} className="space-y-4">
          <label className="flex flex-col gap-1 text-sm">
            Order key
            <input
              list="order-keys"
              className="h-9 rounded-md border bg-background px-2"
              value={orderKey}
              onChange={(e) => setOrderKey(e.target.value)}
              placeholder="Type or pick an order key"
              inputMode="numeric"
            />
            <datalist id="order-keys">
              {keys.data?.map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>
          </label>
          <p className="text-sm text-muted-foreground">
            {me.data ? `Flagging as ${me.data.userName} (${me.data.email ?? 'no email on file'})` : 'Identifying you…'}
          </p>
          <label className="flex flex-col gap-1 text-sm">
            Reason
            <textarea
              className="min-h-24 rounded-md border bg-background p-2"
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            I confirm this order should be flagged
          </label>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Flag order'}
          </Button>
          {message && (
            <Alert variant={message.kind === 'error' ? 'destructive' : 'default'}>
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function History() {
  const history = useQuery({
    queryKey: ['history'],
    queryFn: () => getJson<{ role: string; rows: Row[] }>('/api/flags'),
    staleTime: 0,
  });
  if (history.error) return <Alert variant="destructive"><AlertDescription>{(history.error as Error).message}</AlertDescription></Alert>;
  if (history.isPending) return <p className="text-sm">Loading…</p>;
  return (
    <div className="space-y-2">
    <p className="text-sm text-muted-foreground">Read as the signed-in user, role {history.data.role}</p>
    <Card>
      <CardContent className="p-0">
        <Table striped>
          <TableHeader>
            <TableRow>
              <TableHead>Order key</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Flagged by</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.data.rows.map((h, i) => (
              <TableRow key={i}>
                <TableCell>{h.ORDER_KEY}</TableCell>
                <TableCell className="max-w-sm truncate">{h.REASON}</TableCell>
                <TableCell>{h.FLAGGED_BY}</TableCell>
                <TableCell>{h.FLAGGED_BY_EMAIL ?? '—'}</TableCell>
                <TableCell>{h.SOURCE_APP}</TableCell>
                <TableCell>{formatDateTime(h.CREATED_AT)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
    </div>
  );
}

export function OrderReview() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Explore');
  return (
    <div className="space-y-6">
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm ${tab === t ? 'border-b-2 border-primary font-medium text-primary' : 'text-muted-foreground'}`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'Explore' && <Explore />}
      {tab === 'Flag an order' && <Flag />}
      {tab === 'History' && <History />}
    </div>
  );
}
