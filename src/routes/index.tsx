import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { recordWav } from "@/lib/record-wav";
import { transcribeFile } from "@/lib/transcribe-client";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { suggestReport, CATEGORIES } from "@/lib/suggest.functions";
import { submitReport, listMyReports, deleteMyReport, type MyReport } from "@/lib/reports.functions";
import { supabase } from "@/integrations/supabase/client";
import { useResident } from "@/components/resident-session";
import { CommunityFeed } from "@/components/community-feed";
import { RibEmergency } from "@/components/rib-emergency";
import bgAsset from "@/assets/stop-violence-choose-peace.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Stop Violence — Report our problem fast" },
      { name: "description", content: "Quickly report a problem with a description, location and photo." },
      { property: "og:title", content: "Stop Violence — Report our problem fast" },
      { property: "og:description", content: "Quickly report a problem with a description, location and photo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const schema = z.object({
  description: z.string().trim().min(10, "Please describe the problem (at least 10 characters)").max(2000, "Keep it under 2000 characters"),
  location: z.string().trim().max(200, "Location is too long"),
});
const MAX = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];
type LocalReport = { id: string; description: string; location: string; photo?: string | undefined; category?: string | undefined; summary?: string | undefined; createdAt: string };
const KEY = "pending-reports";

function Index() {
  const { user, ready } = useResident();
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [photo, setPhoto] = useState<string>();
  const photoFile = useRef<File | null>(null);
  const [errors, setErrors] = useState<{ description?: string | undefined; location?: string | undefined; photo?: string | undefined }>({});
  const [localReports, setLocalReports] = useState<LocalReport[]>([]);
  const [onlineReports, setOnlineReports] = useState<MyReport[]>([]);
  const [category, setCategory] = useState("");
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const suggest = useServerFn(suggestReport);
  const submitOnline = useServerFn(submitReport);
  const fetchMine = useServerFn(listMyReports);
  const deleteOnline = useServerFn(deleteMyReport);
  const [voice, setVoice] = useState<"idle" | "recording" | "transcribing">("idle");
  const rec = useRef<{ stop: () => Promise<File> } | null>(null);

  async function refreshOnline() {
    try {
      setOnlineReports(await fetchMine());
    } catch {
      toast.error("Couldn't load your online reports");
    }
  }

  useEffect(() => {
    if (user) void refreshOnline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function toggleVoice() {
    if (voice === "recording" && rec.current) {
      setVoice("transcribing");
      const base = description.trim() ? description.trim() + " " : "";
      try {
        const file = await rec.current.stop();
        await transcribeFile(file, (t) => setDescription(base + t));
        toast.success("Voice message added to the description");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't transcribe");
      } finally { rec.current = null; setVoice("idle"); }
      return;
    }
    try {
      rec.current = await recordWav();
      setVoice("recording");
    } catch {
      toast.error("Microphone access was blocked or unavailable.");
    }
  }

  function removeLocal(id: string) {
    const next = localReports.filter((r) => r.id !== id);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
    setLocalReports(next);
    toast.success("Report deleted");
  }

  async function removeOnline(id: string) {
    try {
      await deleteOnline({ data: { id } });
      setOnlineReports((rows) => rows.filter((r) => r.id !== id));
      toast.success("Report deleted");
    } catch {
      toast.error("Couldn't delete the report");
    }
  }

  async function onSuggest() {
    if (description.trim().length < 10) {
      setErrors((e) => ({ ...e, description: "Write at least 10 characters first" }));
      return;
    }
    setBusy(true);
    try {
      const r = await suggest({ data: { description, ...(photo ? { photo } : {}) } });
      if ("error" in r) toast.error(r.error);
      else { setCategory(r.category); setSummary(r.summary); toast.success("Suggestion ready — edit if needed"); }
    } catch {
      toast.error("Couldn't reach the AI. Check your connection.");
    } finally { setBusy(false); }
  }

  function exportCsv() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const source: { createdAt: string; category?: string | undefined; summary?: string | undefined; description: string; location: string; hasPhoto: boolean }[] = user
      ? onlineReports.map((r) => ({ createdAt: r.created_at, category: r.category, summary: r.summary, description: r.description, location: r.location, hasPhoto: !!r.photoUrl }))
      : localReports.map((r) => ({ createdAt: r.createdAt, category: r.category, summary: r.summary, description: r.description, location: r.location, hasPhoto: !!r.photo }));
    const rows = [["Date", "Category", "Summary", "Description", "Location", "Has photo"],
      ...source.map((r) => [r.createdAt, r.category ?? "", r.summary ?? "", r.description, r.location, r.hasPhoto ? "yes" : "no"])];
    const blob = new Blob(["\ufeff" + rows.map((r) => r.map(esc).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `reports-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  useEffect(() => {
    try { setLocalReports(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { /* ignore */ }
  }, []);

  function onFile(f?: File) {
    setErrors((e) => ({ ...e, photo: "" }));
    photoFile.current = null;
    if (!f) { setPhoto(undefined); return; }
    if (!TYPES.includes(f.type)) { setErrors((e) => ({ ...e, photo: "Only JPG, PNG or WEBP images" })); return; }
    if (f.size > MAX) { setErrors((e) => ({ ...e, photo: "Photo must be under 5 MB" })); return; }
    photoFile.current = f;
    const r = new FileReader();
    r.onload = () => setPhoto(r.result as string);
    r.readAsDataURL(f);
    return undefined;
  }

  async function uploadPhoto(): Promise<string | undefined> {
    const file = photoFile.current;
    if (!file || !user) return undefined;
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("report-photos").upload(path, file, { contentType: file.type });
    if (error) throw new Error("Couldn't upload the photo");
    return path;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const res = schema.safeParse({ description, location });
    if (!res.success) {
      setErrors(Object.fromEntries(res.error.issues.map((i) => [i.path[0], i.message])) as typeof errors);
      return;
    }
    setSaving(true);
    try {
      if (user) {
        const photoPath = await uploadPhoto();
        await submitOnline({ data: { description: res.data.description, location: res.data.location, category, summary: summary.trim(), ...(photoPath ? { photoPath } : {}) } });
        await refreshOnline();
        toast.success("Report saved to your account");
      } else {
        const next = [{ id: crypto.randomUUID(), ...res.data, photo, category: category || undefined, summary: summary.trim() || undefined, createdAt: new Date().toISOString() }, ...localReports];
        try {
          localStorage.setItem(KEY, JSON.stringify(next));
        } catch {
          toast.error("Couldn't save — the photo may be too large for this device");
          return;
        }
        setLocalReports(next);
        toast.success("Report saved on this device");
      }
      setDescription(""); setLocation(""); setPhoto(undefined); photoFile.current = null; setErrors({}); setCategory(""); setSummary("");
      (document.getElementById("photo") as HTMLInputElement).value = "";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the report");
    } finally { setSaving(false); }
  }

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
  }

  const field = "w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
  const shownCount = user ? onlineReports.length : localReports.length;
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center"
        style={{ backgroundImage: `url(${bgAsset.url})` }}
      />
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-background/85" />
      <main className="relative mx-auto max-w-xl px-4 py-10">
      <header className="text-center">
        <p className="text-4xl font-black uppercase tracking-tight text-destructive drop-shadow-sm sm:text-5xl">Stop Violence</p>
        <p className="mt-1 text-lg font-bold uppercase tracking-widest text-foreground">Choose Peace</p>
      </header>
      <div className="mt-4 flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Report our problem fast</h1>
        {ready && (user ? (
          <Button variant="outline" size="sm" onClick={signOut}>Sign out</Button>
        ) : (
          <Button variant="outline" size="sm" asChild><Link to="/auth">Sign in</Link></Button>
        ))}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {user
          ? "Signed in — your reports are saved securely to your account. Your name is never shown on shared reports."
          : "Reports are saved on this device. Sign in to save them securely to your account."}
      </p>

      <form onSubmit={submit} noValidate className="mt-6 space-y-5 rounded-xl border bg-card p-6 shadow-sm">
        <RibEmergency />
        <div>
          <label htmlFor="desc" className="mb-1 block text-sm font-medium">Description *</label>
          <textarea id="desc" rows={5} className={field} value={description} onChange={(e) => setDescription(e.target.value)} aria-invalid={!!errors.description} />
          <Button type="button" variant={voice === "recording" ? "destructive" : "outline"} size="sm" className="mt-2" onClick={toggleVoice} disabled={voice === "transcribing"}>
            {voice === "recording" ? "■ Stop recording" : voice === "transcribing" ? "Transcribing…" : "🎤 Record voice message"}
          </Button>
          {errors.description && <p className="mt-1 text-sm text-destructive">{errors.description}</p>}
        </div>
        <div>
          <label htmlFor="loc" className="mb-1 block text-sm font-medium">Location</label>
          <input id="loc" className={field} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Building B, 2nd floor" />
          {errors.location && <p className="mt-1 text-sm text-destructive">{errors.location}</p>}
        </div>
        <div>
          <label htmlFor="photo" className="mb-1 block text-sm font-medium">Photo (optional)</label>
          <input id="photo" type="file" accept={TYPES.join(",")} onChange={(e) => onFile(e.target.files?.[0])} className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2" />
          {errors.photo && <p className="mt-1 text-sm text-destructive">{errors.photo}</p>}
          {photo && <img src={photo} alt="Selected" className="mt-3 h-32 rounded-md object-cover" />}
        </div>
        <div className="space-y-3 rounded-lg bg-secondary p-4">
          <Button type="button" variant="outline" className="w-full" onClick={onSuggest} disabled={busy}>
            {busy ? "Thinking…" : "✨ Suggest category & summary"}
          </Button>
          <div>
            <label htmlFor="cat" className="mb-1 block text-sm font-medium">Category</label>
            <select id="cat" className={field} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Not set</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="sum" className="mb-1 block text-sm font-medium">Summary</label>
            <input id="sum" maxLength={300} className={field} value={summary} onChange={(e) => setSummary(e.target.value)} />
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={saving}>{saving ? "Saving…" : "Submit report"}</Button>
      </form>

      {user && <CommunityFeed />}

      <section className="mt-10">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{user ? "Your reports" : "Saved reports"} ({shownCount})</h2>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!shownCount}>Export CSV</Button>
        </div>
        {shownCount === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No reports yet.</p>
        ) : user ? (
          <ul className="mt-3 space-y-3">
            {onlineReports.map((r) => (
              <li key={r.id} className="relative flex gap-3 rounded-lg border bg-card p-4 pr-24">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="absolute right-2 top-2 text-destructive">Delete</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this report?</AlertDialogTitle>
                      <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => removeOnline(r.id)}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                {r.photoUrl && <img src={r.photoUrl} alt="" className="h-16 w-16 rounded object-cover" />}
                <div className="min-w-0">
                  {r.category && <p className="text-xs font-semibold text-primary">{r.category}</p>}
                  {r.summary && <p className="text-sm font-medium">{r.summary}</p>}
                  <p className="text-sm break-words">{r.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{r.location || "No location"} · {new Date(r.created_at).toLocaleString()}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="mt-3 space-y-3">
            {localReports.map((r) => (
              <li key={r.id} className="relative flex gap-3 rounded-lg border bg-card p-4 pr-24">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="absolute right-2 top-2 text-destructive">Delete</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this report?</AlertDialogTitle>
                      <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => removeLocal(r.id)}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                {r.photo && <img src={r.photo} alt="" className="h-16 w-16 rounded object-cover" />}
                <div className="min-w-0">
                  {r.category && <p className="text-xs font-semibold text-primary">{r.category}</p>}
                  {r.summary && <p className="text-sm font-medium">{r.summary}</p>}
                  <p className="text-sm break-words">{r.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{r.location || "No location"} · {new Date(r.createdAt).toLocaleString()}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      </main>
    </>
  );
}
