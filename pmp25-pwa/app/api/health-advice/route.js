import { cleanHealthProfile } from "@/lib/healthProfile";
import { buildHealthAdvice } from "@/lib/healthAdvice";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_MODEL = "gemini-2.5-flash";
const VALID_LEVELS = new Set(["low", "moderate", "high"]);

function cleanText(value, fallback, maxLength = 220) {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || fallback).slice(0, maxLength);
}

function parseJsonText(text) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }

    throw new Error("Gemini returned non-JSON advice.");
  }
}

function responseText(data) {
  return (data?.candidates || [])
    .flatMap((candidate) => candidate?.content?.parts || [])
    .map((part) => part?.text || "")
    .join("\n")
    .trim();
}

function sanitizeAdvice(value, language) {
  const chinese = String(language || "").toLowerCase().startsWith("zh");
  const level = VALID_LEVELS.has(value?.level) ? value.level : "moderate";
  const actions = Array.isArray(value?.actions)
    ? value.actions
        .filter((item) => typeof item === "string" && item.trim())
        .slice(0, 4)
        .map((item) => item.trim().slice(0, 180))
    : [];

  return {
    source: "ai",
    level,
    label: cleanText(value?.label, chinese ? "AI 建議" : "AI advice", 40),
    title: cleanText(value?.title, chinese ? "個人化空氣建議" : "Personal air advice", 120),
    summary: cleanText(
      value?.summary,
      chinese
        ? "此建議根據即時空氣品質與你的健康設定產生。"
        : "This suggestion is based on live air quality and your health profile.",
      260
    ),
    actions: actions.length > 0
      ? actions
      : [
          chinese
            ? "請依自身症狀調整戶外時間。"
            : "Adjust outdoor time based on symptoms.",
        ],
  };
}

function fallbackAdvice(payload, source = "profile-rules") {
  const advice = buildHealthAdvice({
    city: payload.displayCity || payload.city,
    pm25: payload.air?.pm25 || 0,
    weatherLabel: payload.air?.weather || "",
    weatherType: payload.air?.weatherType || "",
    profile: payload.profile,
    chinese: payload.language === "zh-TW",
  });

  return {
    ...advice,
    source,
  };
}

function buildPrompt(payload) {
  const chinese = payload.language === "zh-TW";
  const language = chinese ? "Traditional Chinese" : "English";

  return `
You are the health-advice writer for a PM2.5 exposure tracking PWA.
Write concise, practical, non-alarmist wellness guidance in ${language}.

Use this live context:
${JSON.stringify(payload, null, 2)}

Rules:
- Return only valid JSON.
- Do not use markdown.
- Do not mention that you are an AI.
- Do not diagnose disease or give emergency medical instructions.
- Adapt the advice to the user's age level, conditions, activity level, fitness level, PM2.5, weather, humidity, and wind.
- If asthma, cardio, allergies, dust sensitivity, air sensitivity, or outdoor work appears in the profile, personalize for that.
- Keep the language natural for a mobile app card.

JSON schema:
{
  "level": "low" | "moderate" | "high",
  "label": "2-4 word risk label",
  "title": "one short line with city and condition",
  "summary": "one concise personalized explanation",
  "actions": ["2-4 short practical action items"]
}
`;
}

export async function POST(request) {
  const body = await request.json();
  const payload = {
    language: body.language === "zh-TW" ? "zh-TW" : "en",
    city: body.city || "",
    displayCity: body.displayCity || body.city || "",
    air: body.air || {},
    profile: cleanHealthProfile(body.profile || {}),
  };
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return Response.json(fallbackAdvice(payload), {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const geminiResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: buildPrompt(payload) }],
          },
        ],
        generationConfig: {
          temperature: 0.45,
          maxOutputTokens: 420,
          responseMimeType: "application/json",
        },
      }),
    });

    const data = await geminiResponse.json();

    if (!geminiResponse.ok) {
      return Response.json(
        {
          ...fallbackAdvice(payload),
          providerError: data?.error?.message || "Gemini health advice failed.",
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const text = responseText(data);
    const parsed = parseJsonText(text);

    return Response.json(sanitizeAdvice(parsed, payload.language), {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return Response.json(
      {
        ...fallbackAdvice(payload),
        providerError: error.message,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
