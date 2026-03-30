const HF_API_URL = "https://router.huggingface.co/hf-inference/models";
const HF_TOKEN = process.env.HUGGINGFACE_API_KEY;

const HEADERS: Record<string, string> = {
  Authorization: `Bearer ${HF_TOKEN ?? ""}`,
  "Content-Type": "application/json",
};

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

interface HfLabelScore {
  label: string;
  score: number;
}

async function hfPost(model: string, payload: unknown, retried = false): Promise<unknown> {
  const res = await fetch(`${HF_API_URL}/${model}`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(payload),
  });

  if (res.status === 503 && !retried) {
    await new Promise((r) => setTimeout(r, 20_000));
    return hfPost(model, payload, true);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HF API error ${res.status}: ${text}`);
  }

  return res.json();
}

function normalizeLabelScores(result: unknown): HfLabelScore[] {
  if (Array.isArray(result) && result.length > 0 && Array.isArray(result[0])) {
    return result[0] as HfLabelScore[];
  }
  return result as HfLabelScore[];
}

export async function classifySentiment(
  texts: string[]
): Promise<"positive" | "negative" | "neutral" | "mixed"> {
  if (!texts || texts.length === 0) return "neutral";

  const input = texts
    .slice(0, 20)
    .map((t) => t.replace(/\s+/g, " ").trim().slice(0, 200))
    .join(" [SEP] ")
    .slice(0, 1800);

  try {
    const result = await hfPost("cardiffnlp/twitter-roberta-base-sentiment-latest", {
      inputs: input,
    });

    const scores = normalizeLabelScores(result);

    const map: Record<string, number> = {};
    for (const { label, score } of scores) {
      const key = label.toLowerCase();
      map[key] = score;
    }

    const pos = map["positive"] ?? 0;
    const neg = map["negative"] ?? 0;
    const neu = map["neutral"] ?? 0;

    if (pos > 0.3 && neg > 0.3) return "mixed";
    if (pos >= neg && pos >= neu) return "positive";
    if (neg >= pos && neg >= neu) return "negative";
    return "neutral";
  } catch (err) {
    console.error("[HF] classifySentiment failed:", errMessage(err));
    return "neutral";
  }
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export async function generateText(prompt: string, maxTokens = 400): Promise<string> {
  if (!HF_TOKEN || String(HF_TOKEN).trim().length < 8) {
    console.warn(
      "[HF] generateText skipped: set HUGGINGFACE_API_KEY for AI digest / generation."
    );
    return "";
  }

  const models = [
    "meta-llama/Llama-3.2-1B-Instruct:fastest",
    "meta-llama/Llama-3.2-3B-Instruct:fastest",
    "mistralai/Mistral-7B-Instruct-v0.3:fastest",
    "Qwen/Qwen2.5-1.5B-Instruct:fastest",
  ];

  const body = (model: string) => ({
    model,
    messages: [
      {
        role: "system",
        content:
          "You are a concise Premier League journalist for UK readers. Output plain paragraphs only: no markdown, no headings, no bullet lists unless the user explicitly asks.",
      },
      { role: "user", content: prompt },
    ],
    max_tokens: maxTokens,
    temperature: 0.65,
  });

  for (const model of models) {
    try {
      const res = await fetch("https://router.huggingface.co/v1/chat/completions", {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify(body(model)),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HF API error ${res.status}: ${errText}`);
      }

      const data = (await res.json()) as ChatCompletionResponse;
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (text && text.length > 0) return text;
    } catch (err) {
      console.error(`[HF] generateText failed with ${model}:`, errMessage(err));
    }
  }

  return "";
}

export async function generateDigestText(prompt: string, maxTokens = 480): Promise<string> {
  if (!HF_TOKEN || String(HF_TOKEN).trim().length < 8) {
    console.warn(
      "[HF] generateDigestText skipped: set HUGGINGFACE_API_KEY for AI digest / generation."
    );
    return "";
  }

  const models = [
    "meta-llama/Llama-3.2-1B-Instruct:fastest",
    "meta-llama/Llama-3.2-3B-Instruct:fastest",
    "mistralai/Mistral-7B-Instruct-v0.3:fastest",
    "Qwen/Qwen2.5-1.5B-Instruct:fastest",
  ];

  const system = `You are a SportsDeck digest writer. You ONLY restate facts from the user's message.

Hard rules:
- Plain text, short paragraphs, no markdown.
- Use ONLY match results from the RESULTS block; copy team names and scores exactly as written.
- Use ONLY fixtures from the FIXTURES block; copy kick-off lines exactly as written.
- If a block says there are no fixtures or no results in the database, you must say that explicitly and write NOTHING about imaginary games, weekends, or kick-offs.
- Forum sentences must use ONLY thread titles from FORUM HIGHLIGHTS; do not invent thread names.
- If the user gives an ALLOWED TEAM NAMES list, you must not mention any other club names anywhere.`;

  const body = (model: string) => ({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    max_tokens: maxTokens,
    temperature: 0.12,
  });

  for (const model of models) {
    try {
      const res = await fetch("https://router.huggingface.co/v1/chat/completions", {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify(body(model)),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HF API error ${res.status}: ${errText}`);
      }

      const data = (await res.json()) as ChatCompletionResponse;
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (text && text.length > 0) return text;
    } catch (err) {
      console.error(`[HF] generateDigestText failed with ${model}:`, errMessage(err));
    }
  }

  return "";
}

interface TranslationResult {
  translation_text?: string;
}

export async function translateToEnglish(text: string): Promise<string> {
  if (!text || text.trim() === "") return text;

  let sourceLang: string | null = null;
  try {
    const detected = await hfPost("papluca/xlm-roberta-base-language-detection", {
      inputs: text.slice(0, 512),
    });
    const labels = normalizeLabelScores(detected);
    sourceLang = labels[0]?.label?.toLowerCase() ?? null;
  } catch (err) {
    console.error("[HF] language detection failed:", errMessage(err));
  }

  if (sourceLang === "en") return text;

  const models: string[] = [];
  if (sourceLang && sourceLang !== "en") {
    models.push(`Helsinki-NLP/opus-mt-${sourceLang}-en`);
  }
  models.push("Helsinki-NLP/opus-mt-mul-en");

  for (const model of models) {
    try {
      const result = await hfPost(model, { inputs: text.slice(0, 1000) });
      let translated: string | undefined;
      if (Array.isArray(result)) {
        translated = (result[0] as TranslationResult)?.translation_text;
      } else {
        translated = (result as TranslationResult)?.translation_text;
      }

      if (translated && translated.trim().length > 0) return translated.trim();
    } catch (err) {
      console.error(`[HF] translateToEnglish failed with ${model}:`, errMessage(err));
    }
  }

  return text;
}

export interface ToxicityScore {
  score: number;
  label: "toxic" | "neutral";
  verdict: string;
}

export async function scoreToxicity(text: string): Promise<ToxicityScore> {
  const fallback: ToxicityScore = {
    score: 0,
    label: "neutral",
    verdict: "Unable to assess.",
  };
  if (!text || text.trim() === "") return fallback;

  try {
    const result = await hfPost("s-nlp/roberta_toxicity_classifier", {
      inputs: text.slice(0, 512),
    });

    const labels = normalizeLabelScores(result);

    const toxicEntry = labels.find((l) => l.label.toLowerCase() === "toxic");
    const neutralEntry = labels.find((l) => l.label.toLowerCase() === "neutral");

    const toxicScore = toxicEntry?.score ?? 0;
    const neutralScore = neutralEntry?.score ?? 1 - toxicScore;

    const label: "toxic" | "neutral" = toxicScore > 0.5 ? "toxic" : "neutral";

    const verdict =
      label === "toxic"
        ? `This content appears toxic (confidence: ${Math.round(toxicScore * 100)}%). It likely violates community guidelines and should be reviewed.`
        : `This content does not appear to be toxic (confidence: ${Math.round(neutralScore * 100)}%). No action required.`;

    return { score: toxicScore, label, verdict };
  } catch (err) {
    console.error("[HF] scoreToxicity failed:", errMessage(err));
    return fallback;
  }
}
