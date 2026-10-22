import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { suggestReport, CATEGORIES } from "@/lib/suggest.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Report our problem fast" },
      { name: "description", content: "Quickly report a problem with a description, location and photo." },
      { property: "og:title", content: "Report our problem fast" },
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
type Report = { id: string; description: string; location: string; photo?: string | undefined; category?: string | undefined; summary?: string | undefined; createdAt: string };
const KEY = "pending-reports";

function Index() {
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [photo, setPhoto] = useState<string>();
  const [errors, setErrors] = useState<{ description?: string | undefined; location?: string | undefined; photo?: string | undefined }>({});
  const [reports, setReports] = useState<Report[]>([]);
  const [category, setCategory] = useState("");
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const suggest = useServerFn(suggestReport);

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
    const rows = [["Date", "Category", "Summary", "Description", "Location", "Has photo"],
      ...reports.map((r) => [r.createdAt, r.category ?? "", r.summary ?? "", r.description, r.location, r.photo ? "yes" : "no"])];
    const blob = new Blob(["\ufeff" + rows.map((r) => r.map(esc).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `reports-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  useEffect(() => {
    try { setReports(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { /* ignore */ }
  }, []);

  function onFile(f?: File) {
    setErrors((e) => ({ ...e, photo: "" }));
    if (!f) { setPhoto(undefined); return; }
    if (!TYPES.includes(f.type)) { setErrors((e) => ({ ...e, photo: "Only JPG, PNG or WEBP images" })); return; }
    if (f.size > MAX) { setErrors((e) => ({ ...e, photo: "Photo must be under 5 MB" })); return; }
    const r = new FileReader();
    r.onload = () => setPhoto(r.result as string);
    r.readAsDataURL(f);
    return undefined;
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const res = schema.safeParse({ description, location });
    if (!res.success) {
      setErrors(Object.fromEntries(res.error.issues.map((i) => [i.path[0], i.message])) as typeof errors);
      return;
    }
    const next = [{ id: crypto.randomUUID(), ...res.data, photo, category: category || undefined, summary: summary.trim() || undefined, createdAt: new Date().toISOString() }, ...reports];
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      toast.error("Couldn't save — the photo may be too large for this device");
      return;
    }
    setReports(next);
    setDescription(""); setLocation(""); setPhoto(undefined); setErrors({}); setCategory(""); setSummary("");
    (document.getElementById("photo") as HTMLInputElement).value = "";
    toast.success("Report saved");
  }

  const field = "w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Report our problem fast</h1>
      <p className="mt-2 text-sm text-muted-foreground">Reports are saved on this device until secure sign-in is ready.</p>

      <form onSubmit={submit} noValidate className="mt-6 space-y-5 rounded-xl border bg-card p-6 shadow-sm">
        <div>
          <label htmlFor="desc" className="mb-1 block text-sm font-medium">Description *</label>
          <textarea id="desc" rows={5} className={field} value={description} onChange={(e) => setDescription(e.target.value)} aria-invalid={!!errors.description} />
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
        <Button type="submit" className="w-full">Submit report</Button>
      </form>

      <section className="mt-10">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Saved reports ({reports.length})</h2>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!reports.length}>Export CSV</Button>
        </div>
        {reports.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No reports yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {reports.map((r) => (
              <li key={r.id} className="flex gap-3 rounded-lg border bg-card p-4">
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
  );
}
