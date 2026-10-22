import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const CATEGORIES = ["General Report", "Incident Report", "Security Report", "Technical Problem", "Other"] as const;

const input = z.object({
  description: z.string().trim().min(10).max(2000),
  photo: z
    .string()
    .max(7_500_000)
    .regex(/^data:image\/(jpeg|png|webp);base64,/)
    .optional(),
});

export type Suggestion = { category: (typeof CATEGORIES)[number]; summary: string } | { error: string };

export const suggestReport = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data }): Promise<Suggestion> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "AI is not configured." };
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText, Output } = await import("ai");
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    const content: Array<{ type: "text"; text: string } | { type: "image"; image: URL }> = [
      { type: "text", text: `Problem description from a resident:\n${data.description}` },
    ];
    if (data.photo) content.push({ type: "image", image: new URL(data.photo) });
    try {
      const result = streamText({
        model: provider.responses("openai/gpt-6-astra"),
        maxRetries: 0,
        onError: ({ error }) => console.error("AI stream error", error),
        output: Output.object({
          schema: z.object({ category: z.enum(CATEGORIES), summary: z.string() }),
        }),
        instructions:
              "Classify a resident's problem report into one category and write a neutral one-sentence summary (max 25 words). Use the photo if given.",
        messages: [{ role: "user", content }],
        providerOptions: {
          openai: {
            store: false,
            forceReasoning: true,
            reasoningEffort: "low",
            reasoningSummary: "auto",
            include: ["reasoning.encrypted_content"],
          },
        },
      });
      const out = await result.output;
      return { category: out.category, summary: out.summary };
    } catch (e) {
      console.error("suggestReport failed", e);
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 429) return { error: "Too many requests — please try again in a moment." };
      if (status === 402) return { error: "AI credits have run out for this workspace." };
      return { error: "Couldn't get a suggestion right now." };
    }
  });
