import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { join, resolve, extname, relative, isAbsolute } from "node:path";
import { logger } from "../logger.js";
import { testChatAgent } from "./agents/test-chat.js";

// --- caps ------------------------------------------------------------------
// 3-step pipeline: title filter → summary router → reader
//   • title filter: prompt holds only filenames (cheap)
//   • summary router: prompt holds up to TOP_CANDIDATES_LIMIT summaries
//   • reader: prompt holds ONE original file
// 2-step pipeline: summary router (ALL summaries) → reader
const MAX_FILES = 200;               // upper bound on original .md files
const MAX_CHARS_PER_FILE = 200_000;  // ~50K tokens — largest file in user's set is ~86K chars
const MAX_CHARS_PER_SUMMARY = 2_000; // ~500 tokens per summary
const READER_HISTORY_CHARS = 30_000; // ~7.5K tokens of chat history in reader call
const MAX_RESPONSE_CHARS = 4_000;    // response length cap for summary/router/reader
const TOP_CANDIDATES_LIMIT = 4;      // 3-step: titles → top N short-list before the summary router

const SUMMARY_PREFIX = "summary_";

// --- env -------------------------------------------------------------------
const rawMode = process.env.TEST_AGENT_DOCS_MODE;
const rawPath = process.env.TEST_AGENT_DOCS_PATH;

export const testDocsModeEnabled: boolean =
  rawMode === "true" && !!rawPath && rawPath.trim().length > 0;

const resolvedPath = testDocsModeEnabled ? resolve(rawPath!) : null;

// TEST_STEPS controls the router pipeline:
//   2 → read summaries of ALL documents, pick the best, then answer.
//   3 → pre-filter by filename to the top 4, read those summaries, pick the
//       best, then answer. (default — cheaper on folders with many docs)
const testSteps: 2 | 3 = process.env.TEST_STEPS?.trim() === "2" ? 2 : 3;

if (testDocsModeEnabled) {
  logger.info({ path: resolvedPath, steps: testSteps }, "[TestAgent] Docs mode ENABLED");
} else if (rawMode === "true") {
  logger.warn(
    "[TestAgent] TEST_AGENT_DOCS_MODE=true but TEST_AGENT_DOCS_PATH is empty — docs mode disabled"
  );
}

// --- folder walking --------------------------------------------------------
type MdFile = { path: string; name: string };

async function listMdFiles(dir: string): Promise<MdFile[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: MdFile[] = [];
  for (const e of entries) {
    if (out.length >= MAX_FILES) break;
    if (!e.isFile()) continue;
    if (e.name.startsWith(".")) continue;
    if (extname(e.name).toLowerCase() !== ".md") continue;
    out.push({ path: join(dir, e.name), name: e.name });
  }
  return out;
}

function isSummaryName(name: string): boolean {
  return name.startsWith(SUMMARY_PREFIX);
}

function summaryNameFor(originalName: string): string {
  return SUMMARY_PREFIX + originalName;
}

// --- summary generation (lazy, per-file) ----------------------------------
async function summarizeMarkdown(
  content: string,
  filename: string,
  language: string
): Promise<string> {
  const clipped =
    content.length > MAX_CHARS_PER_FILE
      ? content.slice(0, MAX_CHARS_PER_FILE) + "\n…[truncated]"
      : content;
  const messages = [
    { role: "user" as const, content: `Respond in language code "${language}".` },
    { role: "assistant" as const, content: "Understood." },
    {
      role: "user" as const,
      content:
        `Summarize the following Markdown document in 200-400 words. Focus on:\n` +
        `- the document's main topic and purpose\n` +
        `- concrete facts, rules, names, procedures covered\n` +
        `- key terms that might appear in a question about this document\n\n` +
        `Do NOT use markdown formatting. Do NOT invent information. Write plain prose.\n\n` +
        `Filename: ${filename}\n\n` +
        `<document>\n${clipped}\n</document>`,
    },
  ];
  const result = await testChatAgent.generate(messages as any);
  return result.text.slice(0, MAX_CHARS_PER_SUMMARY);
}

const pendingSummaries = new Map<string, Promise<void>>();

async function ensureSummaryForFile(file: MdFile, language: string): Promise<void> {
  if (!resolvedPath) return;
  const summaryPath = join(resolvedPath, summaryNameFor(file.name));

  try {
    const [origStat, sumStat] = await Promise.all([
      stat(file.path),
      stat(summaryPath).catch(() => null),
    ]);
    if (sumStat && sumStat.mtimeMs >= origStat.mtimeMs) return; // up-to-date
  } catch (err) {
    logger.warn({ err, file: file.name }, "[TestAgent] Summary stat failed — skipping");
    return;
  }

  const existing = pendingSummaries.get(file.name);
  if (existing) return existing;

  const work = (async () => {
    logger.info({ file: file.name }, "[TestAgent] Generating summary (lazy)");
    try {
      const content = await readFile(file.path, "utf8");
      const summary = await summarizeMarkdown(content, file.name, language);
      await writeFile(summaryPath, summary, "utf8");
    } catch (err) {
      logger.warn({ err, file: file.name }, "[TestAgent] Failed to summarize file");
    }
  })();

  pendingSummaries.set(file.name, work);
  work.finally(() => pendingSummaries.delete(file.name));
  return work;
}

// --- parsing helpers ------------------------------------------------------
type SummaryEntry = { original: string; summary: string };

function parseRouterResponse(text: string, candidates: string[]): string | null {
  // Look for a candidate filename anywhere in the response (case-insensitive).
  const lower = text.toLowerCase();
  for (const name of candidates) {
    if (lower.includes(name.toLowerCase())) return name;
  }
  // Fallback: trim quotes / code fences from lines and compare exactly.
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line) continue;
    const cleaned = line.replace(/^["'`]+|["'`]+$/g, "");
    if (candidates.includes(cleaned)) return cleaned;
  }
  return null;
}

function parseMultipleFilenames(
  text: string,
  candidates: string[],
  limit: number,
): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) =>
      l
        .trim()
        .replace(/^[-*•]\s*/, "")         // bullet markers
        .replace(/^\d+[.)]\s*/, "")       // numbered markers
        .replace(/^["'`]+|["'`]+$/g, "")  // wrapping quotes
        .replace(/[?.,!;:]+$/, ""),       // trailing punct
    )
    .filter(Boolean);

  const lowerCandidates = candidates.map((c) => c.toLowerCase());
  const found: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    if (found.length >= limit) break;
    const lineLower = line.toLowerCase();

    const exactIdx = lowerCandidates.indexOf(lineLower);
    if (exactIdx >= 0) {
      const name = candidates[exactIdx]!;
      if (!seen.has(name)) {
        seen.add(name);
        found.push(name);
      }
      continue;
    }

    for (let i = 0; i < candidates.length; i++) {
      const c = lowerCandidates[i]!;
      if (lineLower.includes(c) || (lineLower.length > 8 && c.includes(lineLower))) {
        const name = candidates[i]!;
        if (!seen.has(name)) {
          seen.add(name);
          found.push(name);
        }
        break;
      }
    }
  }
  return found;
}

// --- step 2: title pre-filter ---------------------------------------------
async function selectTopCandidatesByTitle(
  question: string,
  language: string,
): Promise<string[]> {
  if (!resolvedPath) return [];
  const files = await listMdFiles(resolvedPath);
  const originals = files.filter((f) => !isSummaryName(f.name));
  if (originals.length === 0) return [];
  if (originals.length <= TOP_CANDIDATES_LIMIT) return originals.map((f) => f.name);

  const list = originals.map((f) => `- ${f.name}`).join("\n");
  const messages = [
    { role: "user" as const, content: `Respond in language code "${language}".` },
    { role: "assistant" as const, content: "Understood." },
    {
      role: "user" as const,
      content:
        `You are a document pre-filter. Below is the list of available document filenames.\n` +
        `The filenames are descriptive and reflect the topic of each document.\n` +
        `Your job: pick the ${TOP_CANDIDATES_LIMIT} filenames most likely to contain the answer to the user's question.\n` +
        `Respond with ONLY the filenames, one per line, in order of relevance. No numbering, no prose, no quotes.\n\n` +
        `Available documents:\n${list}\n\n` +
        `User question: ${question}\n\n` +
        `Top ${TOP_CANDIDATES_LIMIT} filenames:`,
    },
  ];
  const result = await testChatAgent.generate(messages as any);
  const picked = parseMultipleFilenames(
    result.text,
    originals.map((f) => f.name),
    TOP_CANDIDATES_LIMIT,
  );
  if (picked.length === 0) {
    logger.warn(
      { raw: result.text.slice(0, 300) },
      "[TestAgent] Title filter returned no parseable candidates — falling back to first N",
    );
    return originals.slice(0, TOP_CANDIDATES_LIMIT).map((f) => f.name);
  }
  logger.info({ candidates: picked }, "[TestAgent] Title filter top candidates");
  return picked;
}

// --- step 3: summary router on short-list ---------------------------------
async function selectBestFromCandidates(
  candidates: string[],
  question: string,
  language: string,
): Promise<string | null> {
  if (!resolvedPath) return null;
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0]!;

  // Lazy: ensure summary exists for each candidate before loading
  const files = await listMdFiles(resolvedPath);
  const nameSet = new Set(candidates);
  const targets = files.filter((f) => nameSet.has(f.name));
  for (const f of targets) {
    await ensureSummaryForFile(f, language);
  }

  const summaries: SummaryEntry[] = [];
  for (const name of candidates) {
    const summaryPath = join(resolvedPath, summaryNameFor(name));
    try {
      let content = await readFile(summaryPath, "utf8");
      if (content.length > MAX_CHARS_PER_SUMMARY) {
        content = content.slice(0, MAX_CHARS_PER_SUMMARY);
      }
      summaries.push({ original: name, summary: content });
    } catch {
      logger.warn({ name }, "[TestAgent] Summary missing for candidate — skipping");
    }
  }
  const first = summaries[0];
  if (!first) return candidates[0]!; // fallback: raw first candidate
  if (summaries.length === 1) return first.original;

  const list = summaries
    .map((s) => `<summary filename="${s.original}">\n${s.summary}\n</summary>`)
    .join("\n\n");
  const messages = [
    { role: "user" as const, content: `Respond in language code "${language}".` },
    { role: "assistant" as const, content: "Understood." },
    {
      role: "user" as const,
      content:
        `You are a document router. Below are the summaries of ${summaries.length} candidate documents.\n` +
        `Decide which ONE is most relevant to the user's question.\n` +
        `Respond with ONLY the original filename — no prose, no quotes.\n\n` +
        `${list}\n\n` +
        `User question: ${question}\n\n` +
        `Most relevant filename:`,
    },
  ];
  const result = await testChatAgent.generate(messages as any);
  const picked = parseRouterResponse(
    result.text,
    summaries.map((s) => s.original),
  );
  if (!picked) {
    logger.warn(
      { raw: result.text.slice(0, 200) },
      "[TestAgent] Summary router unparseable — falling back to first candidate",
    );
    return first.original;
  }
  return picked;
}

// --- step 1: explicit document reference ----------------------------------
// If the user's question contains "using this document <filename>", skip the
// router steps and read that file directly. Match is case-insensitive against
// the actual filenames in the docs folder. If the referenced file does not
// exist, returns null so the caller can fall back to the router.
async function extractExplicitDocRef(userMessage: string): Promise<string | null> {
  const m = userMessage.match(/using\s+this\s+document\s+(\S+)/i);
  if (!m || !m[1] || !resolvedPath) return null;
  const rawName = m[1]
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/[?.,!;:]+$/, "");
  if (!rawName) return null;

  const files = await listMdFiles(resolvedPath);
  const originals = files.filter((f) => !isSummaryName(f.name));

  const exact = originals.find((f) => f.name.toLowerCase() === rawName.toLowerCase());
  if (exact) return exact.name;

  if (!rawName.toLowerCase().endsWith(".md")) {
    const withExt = originals.find(
      (f) => f.name.toLowerCase() === (rawName + ".md").toLowerCase(),
    );
    if (withExt) return withExt.name;
  }

  return null;
}

// --- step 4: reader -------------------------------------------------------
function trimHistoryForReader(
  history: Array<{ role: "user" | "assistant"; content: string }>,
  maxChars: number
) {
  let total = 0;
  const out: typeof history = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (!msg) continue;
    if (total + msg.content.length > maxChars) break;
    out.unshift(msg);
    total += msg.content.length;
  }
  return out;
}

export async function runTestChatDocsMode(
  history: Array<{ role: "user" | "assistant"; content: string }>,
  userMessage: string,
  language: string
): Promise<string | null> {
  if (!testDocsModeEnabled || !resolvedPath) return null;

  // Validate folder
  try {
    const s = await stat(resolvedPath);
    if (!s.isDirectory()) {
      logger.warn({ path: resolvedPath }, "[TestAgent] Docs path is not a directory");
      return null;
    }
  } catch {
    logger.warn({ path: resolvedPath }, "[TestAgent] Docs path does not exist");
    return null;
  }

  // Step 1: "using this document X.md" — explicit reference bypasses routing
  const explicit = await extractExplicitDocRef(userMessage);

  let picked: string | null;
  if (explicit) {
    logger.info({ picked: explicit }, "[TestAgent] Using explicitly referenced document");
    picked = explicit;
  } else if (testSteps === 2) {
    // 2-step: skip title filter, route directly over ALL document summaries
    const files = await listMdFiles(resolvedPath);
    const all = files.filter((f) => !isSummaryName(f.name)).map((f) => f.name);
    picked = await selectBestFromCandidates(all, userMessage, language);
  } else {
    // 3-step: title pre-filter → top N → summary router
    const candidates = await selectTopCandidatesByTitle(userMessage, language);
    picked = await selectBestFromCandidates(candidates, userMessage, language);
  }
  if (!picked) {
    logger.warn("[TestAgent] No candidates available — falling back to non-docs mode");
    return null;
  }

  // Step 4: reader — read full document and answer
  // Path traversal guard: ensure the resolved file stays within the docs directory
  const fullPath = resolve(resolvedPath, picked);
  const rel = relative(resolvedPath, fullPath);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    logger.warn({ picked, fullPath }, "[TestAgent] Path traversal attempt blocked");
    return null;
  }
  let content: string;
  try {
    content = await readFile(fullPath, "utf8");
  } catch (err) {
    logger.warn({ err, picked }, "[TestAgent] Failed to read selected doc — falling back");
    return null;
  }
  if (content.length > MAX_CHARS_PER_FILE) {
    content = content.slice(0, MAX_CHARS_PER_FILE) + "\n…[truncated]";
  }

  const docsInstruction = {
    role: "user" as const,
    content:
      `You are a clinical pharmacy assistant answering questions from a health professional (pharmacist, physician, nurse). ` +
      `Your task is to answer the user's next question about drug therapy using ONLY the content of the clinical/pharmaceutical guideline provided below.\n\n` +
      `# Strict rules\n\n` +
      `1. **Source-grounded only.** Use ONLY information found in the document. Do not use outside knowledge, training data, or clinical judgment beyond what the document states.\n` +
      `2. **No invented numbers.** Never invent or estimate dosages, durations, frequencies, thresholds, or cut-offs. If a number is not in the document, say so explicitly (in the question's language).\n` +
      `3. **Verbatim dosing.** Quote exact doses, routes, frequencies, and durations from the document (e.g. "500 mg PO BID × 7 jours"). Do not round, convert units, or simplify.\n` +
      `4. **Explicit gaps.** If the document does not answer the question — or only partially answers it — state this clearly at the top of your reply, then give whatever partial information the document does contain.\n` +
      `5. **No boilerplate.** Do not add disclaimers like "consult your doctor", "I am an AI", or "this is not medical advice". The reader is a health professional.\n` +
      `6. **Language.** Answer in the same language the question is asked in. Translate the headings below into that language.\n\n` +
      `# Response structure\n\n` +
      `When the question asks about a treatment, drug choice, or protocol, structure your answer with the following headings. Include a heading ONLY if the document contains relevant information for it — do not invent sections to fill the structure:\n\n` +
      `- **First-line recommendation** — the recommended drug(s) for this clinical situation, with the clinical rationale if the document provides one.\n` +
      `- **Dosing** — exact dose, route, frequency, and duration as stated in the document. Use verbatim quotes for the numbers.\n` +
      `- **Adjustments** — adjustments for renal function (CrCl/eGFR), hepatic function, age, weight, pregnancy/breastfeeding — when the document specifies them.\n` +
      `- **Alternatives** — second-line drugs, drugs for allergy or intolerance, or any alternatives mentioned in the document.\n` +
      `- **Contraindications / precautions** — contraindications, warnings, and precautions listed in the document.\n` +
      `- **Monitoring** — labs, clinical signs, follow-up schedule, or criteria to reassess therapy.\n` +
      `- **Interactions** — significant drug–drug or drug–condition interactions mentioned in the document.\n` +
      `- **Clinical notes** — duration of therapy, criteria to switch or stop, criteria for referral, or any other directly relevant detail.\n\n` +
      `For questions that are NOT about treatment protocols (definitions, epidemiology, diagnostic criteria, mechanism of action, etc.), answer directly in prose without forcing these headings.\n\n` +
      `# Citation\n\n` +
      `At the very end of your response, on a new line by itself, write exactly:\n` +
      `Source: ${picked}\n\n` +
      `# The document\n\n` +
      `<document filename="${picked}">\n${content}\n</document>`,
  };
  const docsAck = {
    role: "assistant" as const,
    content:
      `Understood. I will answer as a clinical pharmacy assistant using ONLY the content of ${picked}. ` +
      `I will quote doses verbatim, use structured headings for treatment questions, explicitly flag anything the document does not cover, and cite the source at the end of my reply.`,
  };

  const messages = [
    {
      role: "user" as const,
      content: `Respond in language code "${language}". All your replies must be in that language.`,
    },
    {
      role: "assistant" as const,
      content: "Understood. I will respond in the requested language.",
    },
    docsInstruction,
    docsAck,
    ...trimHistoryForReader(history, READER_HISTORY_CHARS),
    { role: "user" as const, content: userMessage },
  ];

  const result = await testChatAgent.generate(messages as any);
  return result.text.slice(0, MAX_RESPONSE_CHARS);
}
