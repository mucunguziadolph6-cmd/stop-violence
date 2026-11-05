import { createFileRoute } from "@tanstack/react-router";

const MAX = 20 * 1024 * 1024;

export const Route = createFileRoute("/api/transcribe")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return Response.json({ error: "AI is not configured." }, { status: 500 });
        const len = Number(request.headers.get("content-length") || 0);
        if (len > MAX) return Response.json({ error: "Recording is too long." }, { status: 413 });
        const form = await request.formData().catch(() => null);
        const file = form?.get("file");
        if (!(file instanceof File) || !file.size || file.size > MAX || !file.type.startsWith("audio/")) {
          return Response.json({ error: "Invalid recording." }, { status: 400 });
        }
        const out = new FormData();
        out.append("model", "openai/gpt-transcribe");
        out.append("file", file, file.name);
        out.append("response_format", "json");
        out.append("stream", "true");
        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: out,
          signal: request.signal,
        }).catch(() => null);
        if (!upstream) return Response.json({ error: "Couldn't reach the AI." }, { status: 502 });
        if (!upstream.ok || !upstream.body) {
          const msg =
            upstream.status === 429
              ? "Too many requests — try again shortly."
              : upstream.status === 402
                ? "AI credits have run out for this workspace."
                : "Couldn't transcribe the recording.";
          console.error("transcribe failed", upstream.status, await upstream.text().catch(() => ""));
          return Response.json({ error: msg }, { status: upstream.status });
        }
        const headers = new Headers({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform" });
        upstream.headers.forEach((v, k) => {
          if (k.toLowerCase().startsWith("x-lovable-aig-")) headers.set(k, v);
        });
        return new Response(upstream.body, { status: 200, headers });
      },
    },
  },
});
