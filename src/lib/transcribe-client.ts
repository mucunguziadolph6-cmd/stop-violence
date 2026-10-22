export async function transcribeFile(file: File, onText: (t: string) => void): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/transcribe", { method: "POST", body: form });
  if (!res.ok || !res.body) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error || "Couldn't transcribe the recording.");
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "", text = "", done = false;
  while (true) {
    const { value, done: end } = await reader.read();
    if (end) break;
    buf += value;
    const frames = buf.split(/\r?\n\r?\n/);
    buf = frames.pop() ?? "";
    for (const f of frames) {
      const data = f.split(/\r?\n/).filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("");
      if (!data || data === "[DONE]") continue;
      try {
        const ev = JSON.parse(data) as { type?: string; delta?: string; text?: string; error?: { message?: string } };
        if (ev.type === "transcript.text.delta" && ev.delta) { text += ev.delta; onText(text); }
        else if (ev.type === "transcript.text.done") { text = ev.text ?? text; onText(text); done = true; }
        else if (ev.error) throw new Error("Couldn't transcribe the recording.");
      } catch (e) { if (e instanceof Error && e.message.startsWith("Couldn't")) throw e; }
    }
  }
  if (!done && !text) throw new Error("No speech was recognised. Please try again.");
  return text;
}
