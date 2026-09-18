import { cleanVoiceRepetitions } from "./voice-sale-parser";

export type SpeechResult = { isFinal: boolean; 0: { transcript: string } };
export interface RecognitionEngine {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: { results: ArrayLike<SpeechResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

/** One tap starts one browser session. Never restart the microphone silently. */
export function createVoiceRecording(
  createEngine: () => RecognitionEngine,
  language: string,
  callbacks: {
    onText: (text: string) => void;
    onStableText?: (text: string) => void;
    onFinish: (text: string, status?: { needsReview: boolean }) => void;
    onError: (code: string) => void;
  },
) {
  let engine: RecognitionEngine | null = null;
  let active = true;
  let stopping = false;
  let started = false;
  let text = "";
  let publishedText = "";
  let stableText = "";
  let publishedStableText = "";
  let interimText = "";
  let stopDeadline: ReturnType<typeof setTimeout> | undefined;
  let recordingDeadline: ReturnType<typeof setTimeout> | undefined;

  const cleanup = () => {
    active = false;
    clearTimeout(stopDeadline);
    clearTimeout(recordingDeadline);
    if (engine) {
      engine.onstart = engine.onresult = engine.onerror = engine.onend = null;
      try { engine.abort(); } catch { /* Already stopped by the browser. */ }
      engine = null;
    }
  };
  const finish = () => {
    if (!active) return;
    cleanup();
    callbacks.onFinish(cleanVoiceRepetitions(text), { needsReview: Boolean(interimText.trim()) });
  };
  const fail = (code: string) => {
    if (!active) return;
    cleanup();
    callbacks.onError(code);
  };
  const session = () => {
    if (!active || stopping) return;
    let instance: RecognitionEngine;
    try { instance = createEngine(); } catch { fail("start-failed"); return; }
    engine = instance;
    const finals = new Map<number, string>();
    interimText = "";
    instance.lang = language;
    // Avoid replaying words across continuous recognition / restart boundaries.
    // Keep each spoken order in a single session, including on Android.
    instance.continuous = false;
    instance.interimResults = true;
    instance.maxAlternatives = 1;
    const current = () => active && engine === instance;
    instance.onresult = (event) => {
      if (!current()) return;
      // Final slots are committed once; interim slots are a replaceable
      // snapshot, including when the browser removes its previous guess.
      const pending: string[] = [];
      Array.from(event.results).forEach((result, index) => {
        const transcript = result?.[0]?.transcript?.trim() || "";
        if (result.isFinal) {
          if (!finals.has(index)) finals.set(index, transcript);
        } else if (!finals.has(index)) {
          pending.push(transcript);
        }
      });
      const confirmed = [...finals].sort(([a], [b]) => a - b).map(([, words]) => words).join(" ");
      stableText = confirmed.trim();
      interimText = pending.join(" ").trim();
      text = `${stableText} ${interimText}`.trim();
      const stable = cleanVoiceRepetitions(stableText);
      if (stable !== publishedStableText) {
        publishedStableText = stable;
        callbacks.onStableText?.(stable);
      }
      const cleaned = cleanVoiceRepetitions(text);
      if (cleaned !== publishedText) {
        publishedText = cleaned;
        callbacks.onText(cleaned);
      }
    };
    instance.onerror = ({ error }) => {
      if (!current()) return;
      if (error === "no-speech") { finish(); return; }
      if (error === "aborted" && stopping) { finish(); return; }
      fail(error);
    };
    instance.onend = () => {
      if (!current()) return;
      // Process confirmed speech immediately. Unfinished guesses are returned
      // with needsReview, never replayed into another recording.
      finish();
    };
    try { instance.start(); } catch { fail("start-failed"); }
  };
  return {
    start() {
      if (started || !active) return;
      started = true;
      // Bound recording lifetime, including browsers which never emit end.
      recordingDeadline = setTimeout(() => fail("time-limit"), 120_000);
      session();
    },
    stop() {
      if (!active || stopping) return;
      stopping = true;
      if (!engine) { finish(); return; }
      stopDeadline = setTimeout(finish, 1500);
      try { engine.stop(); } catch { finish(); }
    },
    cancel: cleanup,
  };
}
