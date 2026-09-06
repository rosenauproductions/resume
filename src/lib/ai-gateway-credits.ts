/** AI Gateway credit balance (USD) for pipeline awareness. */

export type AiGatewayCreditsLevel = "ok" | "low" | "empty" | "unknown";

export type AiGatewayCreditsStatus = {
  balance: number | null;
  totalUsed: number | null;
  level: AiGatewayCreditsLevel;
  /** Human label for Settings / banners */
  label: string;
  error?: string;
};

/** Warn in pipeline when remaining balance is under this (USD). */
export const AI_CREDITS_LOW_USD = 1;
/** Treat as empty / chat likely broken under this (USD). */
export const AI_CREDITS_EMPTY_USD = 0.05;

function parseMoney(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const n = Number(raw.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function levelForBalance(balance: number | null): AiGatewayCreditsLevel {
  if (balance == null) return "unknown";
  if (balance <= AI_CREDITS_EMPTY_USD) return "empty";
  if (balance < AI_CREDITS_LOW_USD) return "low";
  return "ok";
}

function formatUsd(n: number | null): string {
  if (n == null) return "—";
  return `$${n.toFixed(2)}`;
}

function gatewayAuthToken(): string | null {
  return (
    process.env.AI_GATEWAY_API_KEY?.trim() ||
    process.env.VERCEL_OIDC_TOKEN?.trim() ||
    null
  );
}

export async function fetchAiGatewayCredits(): Promise<AiGatewayCreditsStatus> {
  const token = gatewayAuthToken();
  if (!token) {
    return {
      balance: null,
      totalUsed: null,
      level: "unknown",
      label: "AI credits · no key",
      error: "AI_GATEWAY_API_KEY not set",
    };
  }

  try {
    const res = await fetch("https://ai-gateway.vercel.sh/v1/credits", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        balance: null,
        totalUsed: null,
        level: "unknown",
        label: "AI credits · unavailable",
        error: `Credits API ${res.status}${body ? `: ${body.slice(0, 120)}` : ""}`,
      };
    }

    const data = (await res.json()) as { balance?: unknown; total_used?: unknown };
    const balance = parseMoney(data.balance);
    const totalUsed = parseMoney(data.total_used);
    const level = levelForBalance(balance);

    const label =
      level === "empty"
        ? `AI credits · empty (${formatUsd(balance)})`
        : level === "low"
          ? `AI credits · low (${formatUsd(balance)})`
          : `AI credits · ${formatUsd(balance)}`;

    return { balance, totalUsed, level, label };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Credits fetch failed";
    return {
      balance: null,
      totalUsed: null,
      level: "unknown",
      label: "AI credits · unavailable",
      error: message,
    };
  }
}
