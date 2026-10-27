import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { listFeedReports } from '@/lib/reports.functions';

// Shows every resident's report to signed-in users, without names.
export function CommunityFeed() {
  const fetchShared = useServerFn(listFeedReports);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['shared-reports'],
    queryFn: () => fetchShared({ data: { page: 0 } }),
    refetchInterval: 15000,
  });
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">Community reports ({data?.length ?? 0})</h2>
      <p className="text-xs text-muted-foreground">Reports sent since you joined. Names are never shown.</p>
      {isLoading ? <p className="mt-2 text-sm">Loading…</p>
        : isError ? <p className="mt-2 text-sm text-destructive">Could not load community reports.</p>
        : !data?.length ? <p className="mt-2 text-sm text-muted-foreground">No reports yet.</p>
        : <ul className="mt-3 space-y-3">{data.map((r) => (
          <li key={r.id} className="rounded-lg border bg-card p-4">
            {r.category && <p className="text-xs font-semibold text-primary">{r.category}</p>}
            {r.summary && <p className="font-medium">{r.summary}</p>}
            <p className="whitespace-pre-wrap break-words text-sm">{r.description}</p>
            <p className="mt-1 text-xs text-muted-foreground">{r.location ? `${r.location} · ` : ''}{new Date(r.created_at).toLocaleString()}</p>
          </li>))}</ul>}
    </section>
  );
}
