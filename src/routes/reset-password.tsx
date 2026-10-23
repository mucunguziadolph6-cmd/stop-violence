import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
export const Route = createFileRoute('/reset-password')({
  head: () => ({ meta: [{ title: 'Reset password | Report our problem fast' }, { name: 'description', content: 'Set a new password for your resident account.' }, { property: 'og:title', content: 'Reset your resident password' }, { property: 'og:description', content: 'Secure account recovery for Report our problem fast.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: ResetPassword,
});
function ResetPassword() {
  const [recovery, setRecovery] = useState(false);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setRecovery(new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery'); }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setMessage(error ? error.message : 'Password updated. You can return to community reports.'); setBusy(false);
  }
  return <main className="mx-auto max-w-md px-4 py-10"><h1 className="text-3xl font-bold">Set a new password</h1>{recovery ? <form onSubmit={submit} className="mt-6 space-y-4"><label htmlFor="new-password">New password</label><input id="new-password" className="w-full rounded-md border border-input bg-card p-3" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} /><Button disabled={busy}>Update password</Button></form> : <p className="mt-4">Open the password reset link from your email to continue.</p>}{message && <p role="status" className="mt-4">{message}</p>}<Button asChild variant="link" className="mt-4"><Link to="/">Community reports</Link></Button></main>;
}