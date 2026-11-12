import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, type FormEvent } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { useResident } from '@/components/resident-session';
import { STAFF_TITLES, STAFF_TITLE_LABELS } from '@/components/school-panel';
import { registerStudent } from '@/lib/students.functions';
import bgAsset from '@/assets/stop-violence-choose-peace.png.asset.json';

export const Route = createFileRoute('/auth')({
  staticData: { sitemap: false },
  head: () => ({ meta: [
    { title: 'Sign in | Report our problem fast' },
    { name: 'description', content: 'Create a resident account or sign in to submit a community report.' },
    { name: 'robots', content: 'noindex' },
    { property: 'og:title', content: 'Resident sign-in | Report our problem fast' },
    { property: 'og:description', content: 'Sign in securely. Your account name stays private.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: AuthPage,
});

type Loc = { id: string; name: string };
type School = { id: string; name: string };

function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [role, setRole] = useState<'student' | 'staff'>('student');
  const [title, setTitle] = useState<string>('DOS');
  const [provinces, setProvinces] = useState<Loc[]>([]);
  const [districts, setDistricts] = useState<Loc[]>([]);
  const [sectors, setSectors] = useState<Loc[]>([]);
  const [sectorSchools, setSectorSchools] = useState<School[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [schoolsLoaded, setSchoolsLoaded] = useState(false);
  const [schoolsError, setSchoolsError] = useState('');
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [sector, setSector] = useState('');
  const [school, setSchool] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const { user } = useResident();
  const navigate = useNavigate();
  const registerStudentFn = useServerFn(registerStudent);

  useEffect(() => { if (user) void navigate({ to: '/', replace: true }); }, [user, navigate]);

  useEffect(() => {
    if (mode !== 'signup' || role !== 'student' || provinces.length) return;
    void supabase.from('provinces').select('id,name').order('name').then(({ data, error }) => {
      if (error) console.error('[auth] Could not load provinces:', error);
      setProvinces(data ?? []);
    });
  }, [mode, role, provinces.length]);

  useEffect(() => {
    setDistricts([]); setDistrict(''); setSectors([]); setSector(''); setSectorSchools([]); setSchool('');
    setSchoolsLoaded(false); setSchoolsLoading(false); setSchoolsError('');
    if (!province) return;
    void supabase.from('districts').select('id,name').eq('province_id', province).order('name').then(({ data, error }) => {
      if (error) console.error('[auth] Could not load districts:', error);
      setDistricts(data ?? []);
    });
  }, [province]);

  useEffect(() => {
    setSectors([]); setSector(''); setSectorSchools([]); setSchool('');
    setSchoolsLoaded(false); setSchoolsLoading(false); setSchoolsError('');
    if (!district) return;
    void supabase.from('sectors').select('id,name').eq('district_id', district).order('name').then(({ data, error }) => {
      if (error) console.error('[auth] Could not load sectors:', error);
      setSectors(data ?? []);
    });
  }, [district]);

  // Legacy schools have no schools.sector column. Their district is stored in
  // schools.district, backfilled from the suffix of name by migration 20261110000001.
  useEffect(() => {
    setSectorSchools([]);
    setSchool('');
    setSchoolsLoaded(false);
    setSchoolsError('');

    const districtName = districts.find((item) => item.id === district)?.name.trim() ?? '';
    if (!districtName || !sector) {
      setSchoolsLoading(false);
      return;
    }

    let cancelled = false;
    setSchoolsLoading(true);
    console.log('[auth] School lookup value:', { district: districtName, districtId: district, sectorId: sector });

    void supabase
      .from('schools')
      .select('id,name')
      .ilike('district', districtName)
      .eq('active', true)
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        console.log('[auth] Full schools Supabase response:', { data, error });
        if (cancelled) return;
        if (error) {
          setSectorSchools([]);
          setSchoolsError(error.message);
        } else {
          const sortedSchools = (data ?? [])
            .map(({ id, name: schoolName }) => ({ id, name: schoolName.split('—', 1)[0]?.trim() ?? schoolName.trim() }))
            .sort((a, b) => a.name.localeCompare(b.name));
          setSectorSchools(sortedSchools);
          setSchoolsError('');
        }
        setSchoolsLoaded(true);
        setSchoolsLoading(false);
      })
      .catch((error: unknown) => {
        console.error('[auth] Unexpected schools query failure:', error);
        if (cancelled) return;
        setSectorSchools([]);
        setSchoolsError(error instanceof Error ? error.message : String(error));
        setSchoolsLoaded(true);
        setSchoolsLoading(false);
      });

    return () => { cancelled = true; };
  }, [sector, district, districts]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setMessage('If an account exists, check your email for a reset link.');
      } else if (mode === 'signup' && role === 'student') {
        if (!province || !district || !sector || !school) { setMessage('Choose your province, district, sector and school.'); return; }
        if (!studentCode.trim()) { setMessage('Enter your student code.'); return; }
        await registerStudentFn({ data: { email: email.trim(), password, fullName: name.trim(), studentCode: studentCode.trim(), schoolId: school, sectorId: sector } });
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) setMessage('Account created — please sign in.');
        else await navigate({ to: '/', replace: true });
      } else if (mode === 'signup') {
        const { error, data } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { display_name: name.trim(), school_role: role, staff_title: role === 'staff' ? title : '' }, emailRedirectTo: window.location.origin } });
        if (error) {
          if (/already|registered|exists/i.test(error.message)) { setMode('login'); setMessage('You already have an account — enter your password to continue.'); return; }
          throw error;
        }
        if (data.user && data.user.identities?.length === 0) { setMode('login'); setMessage('You already have an account — enter your password to continue.'); return; }
        if (data.session) await navigate({ to: '/', replace: true });
        else setMessage('Account created — please sign in.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          if (/not confirmed/i.test(error.message)) throw new Error('Please confirm your email first — check your inbox.');
          if (/invalid login/i.test(error.message)) throw new Error('Wrong email or password. New here? Create an account.');
          throw error;
        }
        await navigate({ to: '/', replace: true });
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  }

  async function social(provider: 'google') {
    setMessage('');
    try {
      const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
      if (result.error) setMessage(result.error.message);
    } catch { setMessage('Sign-in could not start. Please try again.'); }
  }

  const field = 'w-full rounded-md border border-input bg-card px-3 py-2 text-sm';
  const studentSignup = mode === 'signup' && role === 'student';
  const schoolPlaceholder = !sector ? 'Choose a sector first…'
    : schoolsLoading ? 'Loading schools...'
      : schoolsError ? 'Could not load schools'
        : sectorSchools.length ? 'Choose your school…'
          : schoolsLoaded ? 'No school found in this sector' : 'Choose a sector first…';

  return <main className="relative min-h-screen px-4 py-10">
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center" style={{ backgroundImage: `url(${bgAsset.url})` }} />
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-background/85" />
    <div className="mx-auto max-w-md">
      <Button variant="link" asChild><Link to="/">← Community reports</Link></Button>
      <h1 className="mt-5 text-3xl font-bold">{mode === 'signup' ? 'Create your account' : mode === 'forgot' ? 'Reset your password' : 'Resident sign-in'}</h1>
      <form className="mt-6 space-y-4 rounded-lg border bg-card p-6 shadow-sm" onSubmit={submit}>
        {mode === 'signup' && <div>
          <p className="mb-1 text-sm font-medium">I am a…</p>
          <div className="flex gap-2">
            <Button type="button" variant={role === 'student' ? 'default' : 'outline'} onClick={() => setRole('student')}>Student</Button>
            <Button type="button" variant={role === 'staff' ? 'default' : 'outline'} onClick={() => setRole('staff')}>School Administrator</Button>
          </div>
          {role === 'staff' && <select aria-label="Staff position" className={`${field} mt-2`} value={title} onChange={(e) => setTitle(e.target.value)}>{STAFF_TITLES.map((staffTitle) => <option key={staffTitle} value={staffTitle}>{STAFF_TITLE_LABELS[staffTitle]}</option>)}</select>}
          {role === 'staff' && <p className="mt-1 text-xs text-muted-foreground">You'll choose your school after signing in. Staff need approval first.</p>}
        </div>}
        {studentSignup && <div className="space-y-3">
          <div><label htmlFor="province" className="mb-1 block text-sm font-medium">Province</label><select id="province" required className={field} value={province} onChange={(e) => setProvince(e.target.value)}><option value="">Choose province…</option>{provinces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          <div><label htmlFor="district" className="mb-1 block text-sm font-medium">District</label><select id="district" required className={field} value={district} onChange={(e) => setDistrict(e.target.value)} disabled={!province}><option value="">Choose district…</option>{districts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          <div><label htmlFor="sector" className="mb-1 block text-sm font-medium">Sector</label><select id="sector" required className={field} value={sector} onChange={(e) => setSector(e.target.value)} disabled={!district}><option value="">Choose sector…</option>{sectors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          <div>
            <label htmlFor="school" className="mb-1 block text-sm font-medium">School</label>
            <select id="school" required className={field} value={school} onChange={(e) => setSchool(e.target.value)} disabled={!sector || schoolsLoading || !!schoolsError}>
              <option value="">{schoolPlaceholder}</option>
              {sectorSchools.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            {schoolsError && <p role="alert" className="mt-1 text-xs text-destructive">Could not load schools: {schoolsError}</p>}
            {sector && schoolsLoaded && !schoolsLoading && !schoolsError && !sectorSchools.length && <p className="mt-1 text-xs text-muted-foreground">No school found in this sector. Contact your administrator.</p>}
          </div>
        </div>}
        {mode === 'signup' && <div><label htmlFor="resident-name" className="mb-1 block text-sm font-medium">{studentSignup ? 'Full name (as registered at school)' : 'Your name'}</label><input id="resident-name" autoComplete="name" required maxLength={100} className={field} value={name} onChange={(e) => setName(e.target.value)} /></div>}
        {studentSignup && <div><label htmlFor="student-code" className="mb-1 block text-sm font-medium">Student code</label><input id="student-code" required maxLength={50} className={field} placeholder="e.g. 200285" value={studentCode} onChange={(e) => setStudentCode(e.target.value)} /><p className="mt-1 text-xs text-muted-foreground">Your school gives you this code. It can be used only once.</p></div>}
        <div><label htmlFor="email" className="mb-1 block text-sm font-medium">Email</label><input id="email" type="email" required autoComplete="email" className={field} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        {mode !== 'forgot' && <div><label htmlFor="password" className="mb-1 block text-sm font-medium">Password</label><input id="password" type="password" required minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} className={field} value={password} onChange={(e) => setPassword(e.target.value)} /></div>}
        {message && <p role="status" className="break-words text-sm">{message}</p>}
        <Button className="w-full" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Sign in'}</Button>
        {mode !== 'forgot' && <Button type="button" variant="outline" className="w-full" onClick={() => void social('google')}>Continue with Google</Button>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="link" onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setMessage(''); }}>{mode === 'signup' ? 'Already have an account?' : 'Create an account'}</Button>
          <Button type="button" variant="link" onClick={() => { setMode(mode === 'forgot' ? 'login' : 'forgot'); setMessage(''); }}>{mode === 'forgot' ? 'Back to sign in' : 'Forgot password?'}</Button>
        </div>
      </form>
    </div>
  </main>;
}
