import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { chatCache, chatMessages } from "@/lib/db/schema";

/** Minimum Jaccard token overlap to reuse a near-match (first-turn only). */
export const CHAT_CACHE_FUZZY_THRESHOLD = 0.82;

const STOP = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "was",
  "were",
  "do",
  "does",
  "did",
  "you",
  "your",
  "his",
  "her",
  "he",
  "she",
  "chris",
  "christopher",
  "rosenau",
  "about",
  "what",
  "whats",
  "who",
  "how",
  "can",
  "could",
  "would",
  "should",
  "me",
  "my",
  "i",
  "im",
  "please",
  "tell",
  "know",
  "any",
  "of",
  "to",
  "for",
  "in",
  "on",
  "with",
  "and",
  "or",
]);

export type ChatCacheHit = {
  id: string;
  questionNorm: string;
  questionSample: string;
  answer: string;
  hitCount: number;
  match: "exact" | "fuzzy";
  score: number;
};

export function normalizeQuestion(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(norm: string): Set<string> {
  const out = new Set<string>();
  for (const w of norm.split(" ")) {
    if (w.length < 2 || STOP.has(w)) continue;
    out.add(w);
  }
  return out;
}

export function jaccardTokens(a: string, b: string): number {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter += 1;
  return inter / (A.size + B.size - inter);
}

/** Skip caching personal / contact-capture prompts (and contact-intent FAQ). */
export function isContactIntent(question: string): boolean {
  const q = question.toLowerCase();
  return /\b(contact|get in touch|reach (out|you|him|chris)|email (chris|you|him)|call (chris|you|him)|phone|talk to (chris|you)|hire (chris|you)|leave (my )?info|who (are|is) (you|this))\b/.test(
    q,
  );
}

export function shouldSkipCache(question: string): boolean {
  const q = question.toLowerCase();
  if (question.trim().length < 8) return true;
  if (isContactIntent(question)) return true;
  if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test(q)) return true;
  if (/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(q)) return true;
  if (
    /\b(my (name|email|company|phone)|contact me|call me|reach out|here is my|here's my)\b/.test(
      q,
    )
  ) {
    return true;
  }
  return false;
}

/** Remove bad cached dumps that only list Chris's email/phone. */
export async function purgeContactDumpCache() {
  const db = getDb();
  await db.delete(chatCache).where(
    sql`lower(${chatCache.answer}) like '%rosenauproductions@gmail.com%'
      or lower(${chatCache.answer}) like '%945-217-2211%'
      or lower(${chatCache.questionNorm}) like '%contact%'
      or lower(${chatCache.questionNorm}) like '%email%'
      or lower(${chatCache.questionNorm}) like '%reach%'
      or lower(${chatCache.questionNorm}) like '%phone%'`,
  );
}

function scorePair(
  queryNorm: string,
  candidateNorm: string,
): { match: "exact" | "fuzzy"; score: number } {
  if (queryNorm === candidateNorm) return { match: "exact", score: 1 };
  return { match: "fuzzy", score: jaccardTokens(queryNorm, candidateNorm) };
}

export async function findCachedAnswer(
  question: string,
  opts?: { allowFuzzy?: boolean },
): Promise<ChatCacheHit | null> {
  const norm = normalizeQuestion(question);
  if (!norm || shouldSkipCache(question)) return null;

  const db = getDb();
  const allowFuzzy = opts?.allowFuzzy !== false;

  const exact = await db
    .select()
    .from(chatCache)
    .where(eq(chatCache.questionNorm, norm))
    .limit(1);
  if (exact[0]?.answer?.trim()) {
    return {
      id: exact[0].id,
      questionNorm: exact[0].questionNorm,
      questionSample: exact[0].questionSample,
      answer: exact[0].answer,
      hitCount: exact[0].hitCount,
      match: "exact",
      score: 1,
    };
  }

  const [cacheRows, turnRows] = await Promise.all([
    db.select().from(chatCache).orderBy(desc(chatCache.hitCount)).limit(400),
    db
      .select({
        visitorMessage: chatMessages.visitorMessage,
        botReply: chatMessages.botReply,
      })
      .from(chatMessages)
      .where(sql`${chatMessages.fromCache} = false`)
      .orderBy(desc(chatMessages.createdAt))
      .limit(200),
  ]);

  let best: ChatCacheHit | null = null;

  for (const row of cacheRows) {
    const { match, score } = scorePair(norm, row.questionNorm);
    if (match === "exact") {
      return {
        id: row.id,
        questionNorm: row.questionNorm,
        questionSample: row.questionSample,
        answer: row.answer,
        hitCount: row.hitCount,
        match,
        score,
      };
    }
    if (!allowFuzzy || score < CHAT_CACHE_FUZZY_THRESHOLD) continue;
    if (!best || score > best.score) {
      best = {
        id: row.id,
        questionNorm: row.questionNorm,
        questionSample: row.questionSample,
        answer: row.answer,
        hitCount: row.hitCount,
        match: "fuzzy",
        score,
      };
    }
  }

  for (const row of turnRows) {
    const cNorm = normalizeQuestion(row.visitorMessage);
    if (!cNorm || !row.botReply?.trim()) continue;
    const { match, score } = scorePair(norm, cNorm);
    if (match === "exact") {
      return {
        id: "",
        questionNorm: cNorm,
        questionSample: row.visitorMessage,
        answer: row.botReply,
        hitCount: 0,
        match,
        score: 1,
      };
    }
    if (!allowFuzzy || score < CHAT_CACHE_FUZZY_THRESHOLD) continue;
    if (!best || score > best.score) {
      best = {
        id: "",
        questionNorm: cNorm,
        questionSample: row.visitorMessage,
        answer: row.botReply,
        hitCount: 0,
        match: "fuzzy",
        score,
      };
    }
  }

  return best?.answer?.trim() ? best : null;
}

export async function recordCacheHit(hit: ChatCacheHit) {
  const db = getDb();
  if (hit.id) {
    await db
      .update(chatCache)
      .set({
        hitCount: sql`${chatCache.hitCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(chatCache.id, hit.id));
    return;
  }
  await upsertCachedAnswer({
    question: hit.questionSample,
    answer: hit.answer,
    asHit: true,
  });
}

export async function upsertCachedAnswer(input: {
  question: string;
  answer: string;
  asHit?: boolean;
}) {
  if (shouldSkipCache(input.question)) return;
  const answer = (input.answer || "").trim();
  if (!answer) return;
  const norm = normalizeQuestion(input.question);
  if (!norm) return;

  const db = getDb();
  const existing = await db
    .select({ id: chatCache.id, hitCount: chatCache.hitCount })
    .from(chatCache)
    .where(eq(chatCache.questionNorm, norm))
    .limit(1);

  if (existing[0]) {
    await db
      .update(chatCache)
      .set({
        answer,
        questionSample: input.question.slice(0, 500),
        hitCount: input.asHit ? existing[0].hitCount + 1 : existing[0].hitCount,
        updatedAt: new Date(),
      })
      .where(eq(chatCache.id, existing[0].id));
    return;
  }

  await db.insert(chatCache).values({
    questionNorm: norm,
    questionSample: input.question.slice(0, 500),
    answer: answer.slice(0, 8000),
    hitCount: input.asHit ? 1 : 0,
  });
}

export async function listChatCache(limit = 100) {
  const db = getDb();
  return db
    .select()
    .from(chatCache)
    .orderBy(desc(chatCache.hitCount), desc(chatCache.updatedAt))
    .limit(Math.min(Math.max(limit, 1), 300));
}
