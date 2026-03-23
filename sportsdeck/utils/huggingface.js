// lib/huggingface.js
// Prompt: Implement a module for all Hugging Face Inference API calls used by SportsDeck:
//   - classifySentiment(texts[])  → "positive" | "negative" | "neutral"
//   - generateText(prompt)        → string
//   - translateToEnglish(text)    → string
// Use fetch against HF Inference API. Gracefully degrade on failure.
// Claude Sonnet 4.6

const HF_API_URL = "https://router.huggingface.co/hf-inference/models";
const HF_TOKEN   = process.env.HUGGINGFACE_API_KEY;

const HEADERS = {
  Authorization: `Bearer ${HF_TOKEN}`,
  "Content-Type": "application/json",
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * POST to a HF model endpoint. Returns parsed JSON or throws.
 * Retries once after 20 s if the model is still loading (503).
 */
async function hfPost(model, payload, retried = false) {
  const res = await fetch(`${HF_API_URL}/${model}`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(payload),
  });

  if (res.status === 503 && !retried) {
    // Model is cold-starting — wait and retry once
    await new Promise((r) => setTimeout(r, 20_000));
    return hfPost(model, payload, true);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HF API error ${res.status}: ${text}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Sentiment analysis
// ---------------------------------------------------------------------------

/**
 * Classifies the overall sentiment of a body of text.
 *
 * Uses: cardiffnlp/twitter-roberta-base-sentiment-latest
 *   Labels: LABEL_0 = negative, LABEL_1 = neutral, LABEL_2 = positive
 *
 * @param {string[]} texts  Array of post/comment strings to analyse together
 * @returns {"positive"|"negative"|"neutral"|"mixed"}
 */
export async function classifySentiment(texts) {
  if (!texts || texts.length === 0) return "neutral";

  // Concatenate up to 20 posts, truncated, separated by " [SEP] "
  const input = texts
    .slice(0, 20)
    .map((t) => t.replace(/\s+/g, " ").trim().slice(0, 200))
    .join(" [SEP] ")
    .slice(0, 1800); // model max ~512 tokens; keep safe

  try {
    const result = await hfPost(
      "cardiffnlp/twitter-roberta-base-sentiment-latest",
      { inputs: input }
    );

    // result shape: [[{ label, score }, ...]]
    const scores = Array.isArray(result[0]) ? result[0] : result;

    const map = {};
    for (const { label, score } of scores) {
      const key = label.toLowerCase(); // "positive", "negative", "neutral"
      map[key] = score;
    }

    const pos = map["positive"] ?? 0;
    const neg = map["negative"] ?? 0;
    const neu = map["neutral"]  ?? 0;

    // "mixed" when pos and neg are both meaningfully present
    if (pos > 0.3 && neg > 0.3) return "mixed";
    if (pos >= neg && pos >= neu) return "positive";
    if (neg >= pos && neg >= neu) return "negative";
    return "neutral";
  } catch (err) {
    console.error("[HF] classifySentiment failed:", err.message);
    return "neutral"; // graceful degradation
  }
}

// ---------------------------------------------------------------------------
// Text generation (daily digest)
// ---------------------------------------------------------------------------

/**
 * Generates a short text completion from a prompt.
 *
 * Uses the /v1/chat/completions endpoint on router.huggingface.co.
 * Model: Qwen/Qwen2.5-0.5B-Instruct  (tiny, free, confirmed on hf-inference)
 * Falls back to: HuggingFaceTB/SmolLM2-1.7B-Instruct
 *
 * @param {string} prompt
 * @param {number} maxTokens
 * @returns {string}
 */
export async function generateText(prompt, maxTokens = 400) {
  // router.huggingface.co/v1 is the unified OpenAI-compatible endpoint.
  // Model format: "repo/name:provider" — :fastest picks the fastest free provider.
  const models = [
    "meta-llama/Llama-3.2-3B-Instruct:fastest",
    "mistralai/Mistral-7B-Instruct-v0.3:fastest",
  ];

  for (const model of models) {
    try {
      const res = await fetch("https://router.huggingface.co/v1/chat/completions", {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: maxTokens,
          temperature: 0.7,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HF API error ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (text && text.length > 0) return text;
    } catch (err) {
      console.error(`[HF] generateText failed with ${model}:`, err.message);
      // try next model
    }
  }

  return ""; // graceful degradation
}

// ---------------------------------------------------------------------------
// Translation
// ---------------------------------------------------------------------------

/**
 * Translates arbitrary text to English.
 *
 * Uses Helsinki-NLP's OPUS-MT family. We auto-detect the source language
 * with a lightweight LangID model and pick the right translation model.
 * Falls back to the multilingual Helsinki-NLP/opus-mt-mul-en if detection
 * fails or the language pair isn't available.
 *
 * @param {string} text
 * @returns {string}  English translation, or original text on failure
 */
export async function translateToEnglish(text) {
  if (!text || text.trim() === "") return text;

  // Step 1 — detect language
  let sourceLang = null;
  try {
    const detected = await hfPost("papluca/xlm-roberta-base-language-detection", {
      inputs: text.slice(0, 512),
    });
    // result: [[{ label: "fr", score: 0.99 }, ...]]
    const labels = Array.isArray(detected[0]) ? detected[0] : detected;
    sourceLang = labels[0]?.label?.toLowerCase(); // e.g. "fr"
  } catch (err) {
    console.error("[HF] language detection failed:", err.message);
  }

  // Skip translation if already English
  if (sourceLang === "en") return text;

  // Step 2 — translate
  // Try specific pair first (better quality), then multilingual fallback
  const models = [];
  if (sourceLang && sourceLang !== "en") {
    models.push(`Helsinki-NLP/opus-mt-${sourceLang}-en`);
  }
  models.push("Helsinki-NLP/opus-mt-mul-en"); // multilingual fallback

  for (const model of models) {
    try {
      const result = await hfPost(model, { inputs: text.slice(0, 1000) });
      // result: [{ translation_text: "..." }]
      const translated = Array.isArray(result)
        ? result[0]?.translation_text
        : result?.translation_text;

      if (translated && translated.trim().length > 0) return translated.trim();
    } catch (err) {
      console.error(`[HF] translateToEnglish failed with ${model}:`, err.message);
    }
  }

  return text; // graceful degradation — return original
}

// ---------------------------------------------------------------------------
// Toxicity / moderation scoring
// ---------------------------------------------------------------------------

/**
 * Scores text for toxicity (used for auto-flagging reports).
 *
 * Uses: s-nlp/roberta_toxicity_classifier
 *   Labels: "toxic" | "neutral"
 *
 * @param {string} text
 * @returns {{ score: number, label: "toxic"|"neutral", verdict: string }}
 */
export async function scoreToxicity(text) {
  const fallback = { score: 0, label: "neutral", verdict: "Unable to assess." };
  if (!text || text.trim() === "") return fallback;

  try {
    const result = await hfPost("s-nlp/roberta_toxicity_classifier", {
      inputs: text.slice(0, 512),
    });

    const labels = Array.isArray(result[0]) ? result[0] : result;
    // Find the toxic label score
    const toxicEntry  = labels.find((l) => l.label.toLowerCase() === "toxic");
    const neutralEntry = labels.find((l) => l.label.toLowerCase() === "neutral");

    const toxicScore  = toxicEntry?.score  ?? 0;
    const neutralScore = neutralEntry?.score ?? 1 - toxicScore;

    const label = toxicScore > 0.5 ? "toxic" : "neutral";

    const verdict =
      label === "toxic"
        ? `This content appears toxic (confidence: ${Math.round(toxicScore * 100)}%). It likely violates community guidelines and should be reviewed.`
        : `This content does not appear to be toxic (confidence: ${Math.round(neutralScore * 100)}%). No action required.`;

    return { score: toxicScore, label, verdict };
  } catch (err) {
    console.error("[HF] scoreToxicity failed:", err.message);
    return fallback;
  }
}