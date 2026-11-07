import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export const STAFF_TITLES = ['DOS', 'HT', 'Discipline Master'] as const;
export const STAFF_TITLE_LABELS: Record<string, string> = { DOS: 'DOS (Director of Studies)', HT: 'HT (Head Teacher)', 'Discipline Master': 'Discipline Master' };

type Membership = { school_id: string; member_role: string; staff_title: string; status: string };
type School = { id: string; name: string };
type Alert = { id: string; report_id: string; kind: string; created_at: string; read_at: string | null };
type Pending = { user_id: string; display_name: string; staff_title: string; school_name: string };

const field = 'w-full rounded-md border border-input bg-card px-3 py-2 text-sm';

export function SchoolPanel({ user }: { user: User }) {
  const [membership, setMembership] = useState<Membership | null | undefined>(undefined);
  const [schools, setSchools] = useState<School[]>([]);
  const [owner, setOwner] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [openReport, setOpenReport] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [m, s, o, a] = await Promise.all([
      supabase.from('school_memberships').select('school_id,member_role,staff_title,status').eq('user_id', user.id).maybeSingle(),
      Promise.all([0, 1, 2].map((p) => supabase.from('schools').select('id,name').order('name').range(p * 1000, p * 1000 + 999)))
        .then((rs) => ({ data: rs.flatMap((r) => r.data ?? []) })),
      supabase.rpc('is_site_owner'),
      supabase.from('school_notifications').select('id,report_id,kind,created_at,read_at').eq('recipient_id', user.id).order('created_at', { ascending: false }).limit(30),
    ]);
    setMembership(m.data ?? null); setSchools(s.data ?? []); setOwner(!!o.data); setAlerts(a.data ?? []);
  }, [user.id]);

  useEffect(() => { void load(); }, [load]);

  const [notifPerm, setNotifPerm] = useState<string>('default');
  useEffect(() => { if (typeof Notification !== 'undefined') setNotifPerm(Notification.permission); }, []);
  async function enableNotifications() {
    if (typeof Notification === 'undefined') { toast.error('This browser does not support notifications'); return; }
    setNotifPerm(await Notification.requestPermission());
  }

  const announce = useCallback(async (alert: Alert) => {
    const { data: r } = await supabase.from('reports').select('summary,description,location,created_at').eq('id', alert.report_id).maybeSingle();
    const title = alert.kind === 'student_report' ? 'New student report submitted' : 'You received feedback from your school';
    const when = new Date(r?.created_at ?? alert.created_at).toLocaleString();
    const detail = r ? `${(r.summary || r.description).slice(0, 140)}${r.location ? ` · ${r.location}` : ''}` : '';
    const body = `${detail}\n${when}`.trim();
    toast(title, { description: body, duration: 15000, action: { label: 'Open', onClick: () => setOpenReport(alert.report_id) } });
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const n = new Notification(title, { body, tag: alert.id });
      n.onclick = () => { window.focus(); setOpenReport(alert.report_id); n.close(); };
    }
  }, []);

  // On open: immediately announce unread alerts received while away.
  const announced = useRef(false);
  useEffect(() => {
    if (announced.current || !alerts.length) return;
    announced.current = true;
    const unreadList = alerts.filter((a) => !a.read_at); const first = unreadList[0]; if (!first) return;
    if (unreadList.length === 1) void announce(first);
    else if (unreadList.length > 1) toast(`${unreadList.length} new reports/replies waiting`, { duration: 15000, action: { label: 'Open latest', onClick: () => setOpenReport(first.report_id) } });
  }, [alerts, announce]);

  useEffect(() => {
    const channel = supabase.channel(`alerts-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'school_notifications', filter: `recipient_id=eq.${user.id}` }, (payload) => {
        const alert = payload.new as Alert;
        announced.current = true;
        setAlerts((list) => [alert, ...list.filter((x) => x.id !== alert.id)]);
        void announce(alert);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'school_memberships', filter: `user_id=eq.${user.id}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user.id, load, announce]);

  async function openAlert(a: Alert) {
    setOpenReport(a.report_id);
    if (!a.read_at) {
      const now = new Date().toISOString();
      setAlerts((list) => list.map((x) => (x.id === a.id ? { ...x, read_at: now } : x)));
      await supabase.from('school_notifications').update({ read_at: now }).eq('id', a.id);
    }
  }

  if (membership === undefined) return null;
  const schoolName = schools.find((s) => s.id === membership?.school_id)?.name ?? '';
  const isStaff = membership?.member_role === 'staff' && membership.status === 'approved';
  const unread = alerts.filter((a) => !a.read_at).length;

  return (
    <section className="mb-8 space-y-4">
      {owner && <OwnerTools onChange={load} />}
      {!membership || membership.status === 'rejected'
        ? <RoleSetup user={user} schools={schools} rejected={membership?.status === 'rejected'} onDone={load} />
        : <div className="rounded-lg border bg-card p-4 text-sm">
            <p><strong>{membership.member_role === 'student' ? 'Student' : STAFF_TITLE_LABELS[membership.staff_title]}</strong> · {schoolName}</p>
            {membership.status === 'pending' && <p className="mt-1 text-muted-foreground">Waiting for approval. You'll receive student alerts once approved.</p>}
            {membership.member_role === 'student' && <p className="mt-1 text-muted-foreground">Reports you send go privately to your school's staff. Their replies appear below.</p>}
          </div>}
      {(isStaff || membership?.member_role === 'student') && (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="font-semibold">{isStaff ? 'Student reports' : 'Replies from school'} {unread > 0 && <span className="ml-1 rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground">{unread} new</span>}</h2>
          {notifPerm !== 'granted' && <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{notifPerm === 'denied' ? 'Notifications are blocked in your browser settings.' : 'Get alerts on your device even when this tab is in the background.'}</span>
            {notifPerm !== 'denied' && <Button size="sm" variant="outline" onClick={enableNotifications}>Enable notifications</Button>}
          </div>}
          {!alerts.length ? <p className="mt-2 text-sm text-muted-foreground">No notifications yet.</p>
            : <ul className="mt-2 divide-y">{alerts.map((a) => (
              <li key={a.id}><button type="button" onClick={() => openAlert(a)} className={`w-full py-2 text-left text-sm hover:underline ${a.read_at ? 'text-muted-foreground' : 'font-semibold'}`}>
                {a.kind === 'student_report' ? '🔔 A student reported an issue' : '💬 New feedback on your report'} · {new Date(a.created_at).toLocaleString()}
              </button></li>))}</ul>}
        </div>
      )}
      <ReportDialog reportId={openReport} canReply={isStaff} onClose={() => setOpenReport(null)} />
    </section>
  );
}

function RoleSetup({ user, schools, rejected, onDone }: { user: User; schools: School[]; rejected: boolean; onDone: () => void }) {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const metaTitle = String(meta['staff_title'] ?? '');
  const [role, setRole] = useState<'student' | 'staff'>(meta['school_role'] === 'staff' ? 'staff' : 'student');
  const [title, setTitle] = useState<string>((STAFF_TITLES as readonly string[]).includes(metaTitle) ? metaTitle : 'DOS');
  const [school, setSchool] = useState('');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const matches = q ? schools.filter((s) => s.name.toLowerCase().includes(q) || s.id === school) : schools;
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!school) { toast.error('Choose your school'); return; }
    setBusy(true);
    const { error } = await supabase.rpc('request_school_membership', { _school_id: school, _role: role, _title: role === 'staff' ? title : '' });
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success(role === 'staff' ? 'Request sent for approval' : 'You joined your school'); onDone(); }
  }
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <h2 className="font-semibold">Who are you?</h2>
      {rejected && <p className="text-sm text-destructive">Your staff request was not approved. You can choose again.</p>}
      <div className="flex gap-2">
        <Button type="button" variant={role === 'student' ? 'default' : 'outline'} onClick={() => setRole('student')}>Student</Button>
        <Button type="button" variant={role === 'staff' ? 'default' : 'outline'} onClick={() => setRole('staff')}>School Administrator</Button>
      </div>
      {role === 'staff' && <select aria-label="Staff position" className={field} value={title} onChange={(e) => setTitle(e.target.value)}>
        {STAFF_TITLES.map((t) => <option key={t} value={t}>{STAFF_TITLE_LABELS[t]}</option>)}
      </select>}
      <input aria-label="Search school" className={field} placeholder="Type your school or district…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <select aria-label="School" className={field} value={school} onChange={(e) => setSchool(e.target.value)}>
        <option value="">{matches.length ? `Choose your school (${matches.length} found)…` : 'No school matches'}</option>
        {matches.slice(0, 300).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      {!schools.length && <p className="text-xs text-muted-foreground">No schools have been added yet.</p>}
      <Button type="button" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Continue'}</Button>
    </div>
  );
}

function OwnerTools({ onChange }: { onChange: () => void }) {
  const [name, setName] = useState('');
  const [pending, setPending] = useState<Pending[]>([]);
  const loadPending = useCallback(async () => { const { data } = await supabase.rpc('list_pending_staff'); setPending(data ?? []); }, []);
  useEffect(() => { void loadPending(); const t = setInterval(loadPending, 15000); return () => clearInterval(t); }, [loadPending]);
  async function addSchool() {
    const { error } = await supabase.rpc('create_school', { _name: name });
    if (error) toast.error(error.message); else { toast.success('School added'); setName(''); onChange(); }
  }
  async function review(id: string, approve: boolean) {
    const { error } = await supabase.rpc('review_school_membership', { _user_id: id, _approve: approve });
    if (error) toast.error(error.message); else { toast.success(approve ? 'Staff approved' : 'Request declined'); void loadPending(); }
  }
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <h2 className="font-semibold">Site owner tools</h2>
      <Button variant="outline" size="sm" asChild><Link to="/admin">Open admin page (schools, students, locations)</Link></Button>
      <div className="flex gap-2"><input aria-label="New school name" className={field} placeholder="School name" value={name} onChange={(e) => setName(e.target.value)} /><Button type="button" onClick={addSchool} disabled={name.trim().length < 2}>Add school</Button></div>
      <p className="text-sm font-medium">Staff waiting for approval ({pending.length})</p>
      <ul className="space-y-2">{pending.map((p) => (
        <li key={p.user_id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>{p.display_name || 'Unnamed'} — {STAFF_TITLE_LABELS[p.staff_title]} at {p.school_name}</span>
          <span className="flex gap-2"><Button size="sm" onClick={() => review(p.user_id, true)}>Approve</Button><Button size="sm" variant="outline" onClick={() => review(p.user_id, false)}>Decline</Button></span>
        </li>))}</ul>
    </div>
  );
}

type ReportView = { description: string; location: string; category: string; summary: string; created_at: string; photo_path: string | null };
type Feedback = { id: string; staff_title: string; message: string; created_at: string };

function ReportDialog({ reportId, canReply, onClose }: { reportId: string | null; canReply: boolean; onClose: () => void }) {
  const [report, setReport] = useState<ReportView | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [text, setText] = useState('');
  const loadFeedback = useCallback(async (id: string) => {
    const { data } = await supabase.from('report_feedback').select('id,staff_title,message,created_at').eq('report_id', id).order('created_at');
    setFeedback(data ?? []);
  }, []);
  useEffect(() => {
    setReport(null); setPhoto(null); setFeedback([]); setText('');
    if (!reportId) return;
    void (async () => {
      const { data } = await supabase.from('reports').select('description,location,category,summary,created_at,photo_path').eq('id', reportId).maybeSingle();
      setReport(data);
      if (data?.photo_path) { const s = await supabase.storage.from('report-photos').createSignedUrl(data.photo_path, 3600); setPhoto(s.data?.signedUrl ?? null); }
      await loadFeedback(reportId);
    })();
  }, [reportId, loadFeedback]);
  async function send() {
    if (!reportId) return;
    const { error } = await supabase.from('report_feedback').insert({ report_id: reportId, message: text.trim() });
    if (error) toast.error('Could not send feedback'); else { setText(''); toast.success('Feedback sent to the student'); void loadFeedback(reportId); }
  }
  return (
    <Dialog open={!!reportId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Reported problem</DialogTitle></DialogHeader>
        {!report ? <p className="text-sm">Loading…</p> : <div className="space-y-3 text-sm">
          {report.category && <p className="text-xs font-semibold text-primary">{report.category}</p>}
          {report.summary && <p className="font-medium">{report.summary}</p>}
          <p className="whitespace-pre-wrap break-words">{report.description}</p>
          <p className="text-xs text-muted-foreground">{report.location ? `${report.location} · ` : ''}{new Date(report.created_at).toLocaleString()}</p>
          {photo && <img src={photo} alt="Report attachment" className="max-h-64 rounded-md border" />}
          <h3 className="pt-2 font-semibold">Feedback</h3>
          {!feedback.length ? <p className="text-muted-foreground">No feedback yet.</p>
            : <ul className="space-y-2">{feedback.map((f) => <li key={f.id} className="rounded-md bg-muted p-2"><p className="text-xs font-semibold">{STAFF_TITLE_LABELS[f.staff_title] ?? 'School staff'} · {new Date(f.created_at).toLocaleString()}</p><p className="whitespace-pre-wrap">{f.message}</p></li>)}</ul>}
          {canReply && <div className="space-y-2">
            <textarea aria-label="Feedback for the student" className={field} rows={3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write advice or feedback for the student" />
            <Button type="button" onClick={send} disabled={!text.trim()}>Send feedback</Button>
          </div>}
        </div>}
      </DialogContent>
    </Dialog>
  );
}
