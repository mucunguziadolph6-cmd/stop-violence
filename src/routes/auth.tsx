import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { useResident } from '@/components/resident-session';
import { STAFF_TITLES, STAFF_TITLE_LABELS } from '@/components/school-panel';
import bgAsset from '@/assets/stop-violence-choose-peace.png.asset.json';
import '@lovable.dev/cloud-auth-js/styles.css';

export const Route = createFileRoute('/auth')({
  head: () => ({ meta: [
    { title: 'Sign in | Report our problem fast' },
    { name: 'description', content: 'Create a resident account or sign in to submit a community report.' },
    { property: 'og:title', content: 'Resident sign-in | Report our problem fast' },
    { property: 'og:description', content: 'Sign in securely. Your account name stays private.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }), component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [role, setRole] = useState<'student' | 'staff'>('student');
  const [title, setTitle] = useState<string>('DOS');
  const { user } = useResident();
  const navigate = useNavigate();
  useEffect(() => { if (user) void navigate({ to: '/', replace: true }); }, [user, navigate]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setMessage('If an account exists, check your email for a reset link.');
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
  async function social(provider: 'google' | 'lovable') {
    setMessage('');
    try {
      const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
      if (result.error) setMessage(result.error.message);
    } catch { setMessage('Sign-in could not start. Please try again.'); }
  }
  const field = 'w-full rounded-md border border-input bg-card px-3 py-2 text-sm';
  return <main className="relative min-h-screen px-4 py-10">
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center" style={{ backgroundImage: `url(${bgAsset.url})` }} />
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-background/85" />
    <div className="mx-auto max-w-md">
      <Button variant="link" asChild><Link to="/">← Community reports</Link></Button>
      <h1 className="mt-5 text-3xl font-bold">{mode === 'signup' ? 'Create your account' : mode === 'forgot' ? 'Reset your password' : 'Resident sign-in'}</h1>
      <form className="mt-6 space-y-4 rounded-lg border bg-card p-6 shadow-sm" onSubmit={submit}>
        {mode === 'signup' && <div><label htmlFor="resident-name" className="mb-1 block text-sm font-medium">Your name</label><input id="resident-name" autoComplete="name" required maxLength={100} className={field} value={name} onChange={e => setName(e.target.value)} /></div>}
        {mode === 'signup' && <div><p className="mb-1 text-sm font-medium">I am a…</p><div className="flex gap-2"><Button type="button" variant={role === 'student' ? 'default' : 'outline'} onClick={() => setRole('student')}>Student</Button><Button type="button" variant={role === 'staff' ? 'default' : 'outline'} onClick={() => setRole('staff')}>School Administrator</Button></div>
          {role === 'staff' && <select aria-label="Staff position" className={`${field} mt-2`} value={title} onChange={e => setTitle(e.target.value)}>{STAFF_TITLES.map(t => <option key={t} value={t}>{STAFF_TITLE_LABELS[t]}</option>)}</select>}
          <p className="mt-1 text-xs text-muted-foreground">You'll choose your school after signing in. Staff need approval first.</p></div>}
        <div><label htmlFor="email" className="mb-1 block text-sm font-medium">Email</label><input id="email" type="email" required autoComplete="email" className={field} value={email} onChange={e => setEmail(e.target.value)} /></div>
        {mode !== 'forgot' && <div><label htmlFor="password" className="mb-1 block text-sm font-medium">Password</label><input id="password" type="password" required minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} className={field} value={password} onChange={e => setPassword(e.target.value)} /></div>}
        {message && <p role="status" className="break-words text-sm">{message}</p>}
        <Button className="w-full" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Sign in'}</Button>
        {mode !== 'forgot' && <><Button type="button" variant="outline" className="w-full" onClick={() => social('google')}>Continue with Google</Button><Button type="button" className="lovable-auth-button w-full" onClick={() => social('lovable')}>Continue with Lovable</Button></>}
        <div className="flex flex-wrap gap-2"><Button type="button" variant="link" onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setMessage(''); }}>{mode === 'signup' ? 'Already have an account?' : 'Create an account'}</Button><Button type="button" variant="link" onClick={() => { setMode(mode === 'forgot' ? 'login' : 'forgot'); setMessage(''); }}>{mode === 'forgot' ? 'Back to sign in' : 'Forgot password?'}</Button></div>
      </form>
    </div>
  </main>;
}