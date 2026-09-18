"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  cleanVoiceRepetitions,
  normalizeVoiceText,
  parseVoiceSaleCommand,
  type VoiceSaleRequest,
} from "@/lib/voice-sale-parser";
import { checkVoiceStock, convertVoiceQuantity, matchVoiceProducts, shortlistVoiceProducts } from "@/lib/voice-sale-matching";
import { createVoiceRecording, type RecognitionEngine } from "@/lib/voice-recording";
import { SaleQuantityControl } from "./sale-quantity-control";
import { maxSaleQuantity } from "@/lib/sale-quantity";
import { formatMoney, formatNumber } from "@/lib/number-format";

type SaleLine = {
  itemId: number;
  itemName: string;
  quantity: number;
  displayQuantity: string;
  unitId: number;
  unitShortForm: string;
  pricePerUnit: number;
  totalPrice: number;
  costPerUnit: number;
  totalCost: number;
};
type Draft = {
  id: string;
  query: string;
  quantity: number;
  quantityInput?: string;
  requestedUnit?: string;
  priceOverride?: number;
  candidates: any[];
  selectedId: number | null;

};

export function VoiceSaleAssistant({
  items,
  units,
  onAdd,
  onSearchRequested,
  onProductSelected,
  addedItems = [],
  autoFocus = false,
}: {
  items: any[];
  units: any[];
  onAdd: (line: SaleLine) => void;
  onSearchRequested?: (query: string, onResolved: (itemId: number) => void) => void;
  onProductSelected?: (itemId: number, quantity: number, requestedUnit?: string, onAdded?: () => void) => void;
  addedItems?: Array<{ itemId: number; quantity: number }>;
  autoFocus?: boolean;
}) {
  const [command, setCommand] = useState("");
  const [listening, setListening] = useState(false);
  const [stableCommand, setStableCommand] = useState("");
  const [needsCorrection, setNeedsCorrection] = useState(false);
  const [draft, setDraft] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const parsingRef = useRef(false);
  const appendRecording = useRef(false);
  const lastParsedIds = useRef(new Set<string>());
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const recording = useRef<ReturnType<typeof createVoiceRecording> | null>(null);
  const recordingId = useRef(0);
  const label = (english: string, marathi: string) => (english);
  const productName = (item: any) => {
    if (!item) return "";
    const name = (item.name);
    const brand = (item.brand);
    return brand ? `${name} (${brand})` : name;
  };
  const unitLabel = (unit: string) => (unit);

  useEffect(() => () => {
    recordingId.current += 1;
    recording.current?.cancel();
  }, []);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const resolveDraftLine = (line: Draft) => {
    const item = items.find((candidate) => candidate.id === line.selectedId);
    if (!item) return { state: "unmatched" as const };
    const unit = units.find((candidate) => candidate.id === item.unitId);
    const unitName = unit?.shortForm || "unit";
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) return { state: "quantity" as const };
    const quantity = convertVoiceQuantity(line.quantity, line.requestedUnit, unitName);
    if (quantity === null) return { state: "unit" as const, item, unitName };
    if (item.sellPrice == null || item.buyPrice == null || !Number.isFinite(Number(item.sellPrice)) || Number(item.sellPrice) <= 0 ||
        !Number.isFinite(Number(item.buyPrice)) || !Number.isFinite(Number(item.quantity))) {
      return { state: "variant" as const, item };
    }
    if (line.priceOverride != null) return { state: "variant" as const, item };
    const stock = checkVoiceStock({...item, quantity: Number(item.quantity)}, quantity,
      addedItems.filter((entry) => entry.itemId === item.id).reduce((sum, entry) => sum + entry.quantity, 0));
    if (stock.state === "invalid") return { state: "variant" as const, item };
    if (stock.state !== "ready") return { ...stock, item };
    return {
      state: "ready" as const,
      saleLine: {
        itemId: item.id,
        itemName: productName(item),
        quantity,
        displayQuantity: `${line.quantity} ${line.requestedUnit || unitName}`,
        unitId: item.unitId,
        unitShortForm: unitName,
        pricePerUnit: Number(item.sellPrice),
        totalPrice: quantity * Number(item.sellPrice),
        costPerUnit: Number(item.buyPrice),
        totalCost: quantity * Number(item.buyPrice),
      },
    };
  };

  const buildDraft = (
    requests: VoiceSaleRequest[],
  ) => {
    const uniqueRequests = requests.reduce<typeof requests>(
      (result, request) => {
        const query = normalizeVoiceText(
          request.productQuery,
        );
        const key = `${query}|${request.requestedUnit || ""}|${request.priceOverride ?? ""}`;
        const previous = result.find((entry) => {
          const previousQuery = normalizeVoiceText(
            entry.productQuery,
          );
          return (
            (request.quantity ?? 1) > 0 && (entry.quantity ?? 1) > 0 &&
            `${previousQuery}|${entry.requestedUnit || ""}|${entry.priceOverride ?? ""}` ===
            key
          );
        });
        if (previous) {
          previous.quantity =
            (previous.quantity ?? 1) + (request.quantity ?? 1);
        } else {
          result.push({ ...request });
        }
        return result;
      },
      [],
    );

    const lines = uniqueRequests.map((request) => {
      const query = request.productQuery;
      const local = matchVoiceProducts(query, items);
      const selectedId = local.selectedId;
      const candidates = shortlistVoiceProducts(query, items);
      const selected = items.find((item) => item.id === selectedId);
      if (selected && !candidates.some((item) => item.id === selectedId)) candidates.unshift(selected);
      return {
        id: crypto.randomUUID(),
        query,
        quantity: request.quantity ?? 1,
        requestedUnit: request.requestedUnit,
        priceOverride: request.priceOverride,
        candidates,
        selectedId,
      };
    });
    const append = appendRecording.current;
    const replacedIds = lastParsedIds.current;
    setDraft((current) => [...(append ? current : current.filter((entry) => !replacedIds.has(entry.id))), ...lines]);
    lastParsedIds.current = new Set(lines.map((entry) => entry.id));
    setMessage("");
  };

  const parseTranscript = (rawTranscript: string) => {
    const cleaned = cleanVoiceRepetitions(rawTranscript);
    if (!cleaned || parsingRef.current) return;
    setCommand(cleaned);
    parsingRef.current = true;
    setBusy(true);
    try {
      setMessage(label("Checking products and stock…", "वस्तू आणि साठा तपासत आहे…"));
      const parsed = parseVoiceSaleCommand(cleaned);
      if (parsed.length > 0) {
        setNeedsCorrection(false);
        buildDraft(parsed);
        appendRecording.current = false;
      } else {
        setNeedsCorrection(true);
        setMessage(
          label("No products recognised. Edit the words below or search.", "वस्तू ओळखता आल्या नाहीत. खाली शब्द दुरुस्त करा किंवा शोधा."),
        );
      }
    } finally {
      parsingRef.current = false;
      setBusy(false);
    }
  };

  const review = () => {
    parseTranscript(command.trim());
  };

  const parseLatest = useRef(parseTranscript);
  parseLatest.current = parseTranscript;

  const startListening = () => {
    if (typeof window === "undefined" || recording.current) return;
    const speechWindow = window as unknown as {
      SpeechRecognition?: new () => RecognitionEngine;
      webkitSpeechRecognition?: new () => RecognitionEngine;
    };
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setMessage(label("Voice unavailable here. Use product search.", "येथे आवाजाने नोंद उपलब्ध नाही. वस्तू शोधून जोडा."));
      return;
    }
    appendRecording.current = true;
    setCommand("");
    setStableCommand("");
    setNeedsCorrection(false);
    setListening(true);
    setMessage(label("Say your items. They’ll appear when you finish speaking.", "वस्तू सांगा. बोलून झाल्यावर त्या दिसतील."));
    const id = ++recordingId.current;
    const session = createVoiceRecording(() => new Recognition(), "en-IN", {
      onText: (text) => { if (recordingId.current === id) setCommand(text); },
      onStableText: (text) => { if (recordingId.current === id) setStableCommand(text); },
      onFinish: (text, status) => {
        if (recordingId.current !== id) return;
        recording.current = null;
        setListening(false);
        if (text && status?.needsReview) {
          setNeedsCorrection(true);
          setCommand(text);
          setMessage(label("Some words weren't confirmed. Check the saved words or speak again.", "काही शब्द निश्चित झाले नाहीत. ऐकलेले शब्द तपासा किंवा पुन्हा बोला."));
        } else if (text) parseLatest.current(text);
        else setMessage(label("Nothing was heard. Try again.", "आवाज ऐकू आला नाही. पुन्हा बोला."));
      },
      onError: (code) => {
        if (recordingId.current !== id) return;
        recording.current = null;
        setListening(false);
        setNeedsCorrection(true);
        const errors: Record<string, [string, string]> = {
          network: ["Connection lost. Edit the saved words or try again.", "इंटरनेट जोडणी तुटली. ऐकलेले शब्द दुरुस्त करा किंवा पुन्हा बोला."],
          "not-allowed": ["Allow microphone access in the browser, then try again.", "ब्राउझरमध्ये माइकची परवानगी द्या आणि पुन्हा प्रयत्न करा."],
          "service-not-allowed": ["Speech recognition is blocked in this browser. Use search.", "ब्राउझरने आवाज ओळखण्याची सुविधा बंद केली आहे. शोध वापरा."],
          "audio-capture": ["No microphone found. Connect it or use search.", "माइक सापडला नाही. माइक जोडा किंवा शोध वापरा."],
          "language-not-supported": ["English speech is unavailable in this browser. Use product search.", "English speech is unavailable in this browser. Use product search."],
          "no-speech": ["Nothing more was heard. Check the saved words below.", "पुढील आवाज ऐकू आला नाही. खालील शब्द तपासा."],
          "time-limit": ["Recording stopped after two minutes. Check the saved words below.", "दोन मिनिटांनंतर रेकॉर्डिंग थांबले. खालील शब्द तपासा."],
        };
        const error = errors[code] || ["Voice stopped. Check the saved words or try again.", "रेकॉर्डिंग थांबले. ऐकलेले शब्द तपासा किंवा पुन्हा बोला."];
        setMessage(label(error[0], error[1]));
      },
    });
    recording.current = session;
    session.start();
  };
  const stopListening = () => recording.current?.stop();
  const cancelVoice = () => {
    parsingRef.current = false;
    setBusy(false);
    recordingId.current += 1;
    recording.current?.cancel();
    recording.current = null;
    setListening(false);
    setStableCommand("");
    setNeedsCorrection(false);
    setCommand("");
    appendRecording.current = false;
    setMessage(label("Recording cancelled. Reviewed items are kept.", "रेकॉर्डिंग रद्द झाले. तपासलेल्या वस्तू तशाच आहेत."));
  };
  const choose = (id: string, selectedId: number) => {
    setDraft((current) => current.map((line) => line.id === id ? {...line, selectedId} : line));
    if (!needsCorrection) setCommand("");
  };
  const removeDraftLine = (id: string) => {
    setDraft((current) => current.filter((line) => line.id !== id));
    if (!needsCorrection) setCommand("");
  };
  // Reserve quantities in spoken order as well as quantities already in the bill.
  const reserved = new Map<number, number>();
  const reviewed = draft.map((line) => {
    const result = resolveDraftLine(line);
    if (result.state !== "ready") return { line, result };
    const sale = result.saleLine;
    const item = items.find((entry) => entry.id === sale.itemId);
    const available = Math.max(0, Number((Number(item?.quantity || 0)
      - addedItems.filter((entry) => entry.itemId === sale.itemId).reduce((sum, entry) => sum + entry.quantity, 0)
      - (reserved.get(sale.itemId) || 0)).toFixed(6)));
    if (sale.quantity > available) return { line, result: { state: "insufficient" as const, available, item } };
    reserved.set(sale.itemId, (reserved.get(sale.itemId) || 0) + sale.quantity);
    return { line, result };
  });
  const ready = reviewed.filter((entry) => entry.result.state === "ready");
  const addConfirmed = () => {
    const ids = new Set<string>();
    if (!needsCorrection) setCommand("");
    ready.forEach(({ line, result }) => {
      if (result.state === "ready") { onAdd(result.saleLine); ids.add(line.id); }
    });
    setDraft((current) => current.filter((line) => !ids.has(line.id)));
    setMessage(label(`${ids.size} products added to the bill.`, `${ids.size} वस्तू बिलात जोडल्या.`));
  };
  const searchInstead = (line: Draft) => {
    onSearchRequested?.(line.query, (itemId) => choose(line.id, itemId));
    setMessage(label("Choose a product in search to replace this item.", "ही वस्तू बदलण्यासाठी शोधातून वस्तू निवडा."));
  };

  return (
    <section lang={("en")} className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" disabled={busy} onClick={listening ? stopListening : startListening}
          className={`h-12 gap-2 rounded-xl ${listening ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700"}`}>
          <Mic className="h-5 w-5" />
          {listening ? label("Done", "पूर्ण झाले") : draft.length > 0 ? label("Speak more", "आणखी वस्तू सांगा") : label("Speak order", "बोलून वस्तू जोडा")}
        </Button>
        {listening && <Button type="button" variant="ghost" className="h-12" onClick={cancelVoice}>{label("Cancel", "रद्द करा")}</Button>}
        {!listening && draft.length === 0 && !command && !message &&
          <p className="text-xs text-slate-500">{label("Try: two Parle-G, one milk", "उदा. दोन पार्ले जी, एक दूध")}</p>}
      </div>
      {message && <p role="status" className="text-sm text-slate-600">{message}</p>}
      {listening && stableCommand && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{stableCommand}</p>}

      {!listening && command && (draft.length === 0 || needsCorrection) && <div className="space-y-2 rounded-xl border border-slate-200 p-3">
        <label className="text-sm font-medium" htmlFor="voice-recovery">{label("Check these words", "हे शब्द तपासा")}</label>
        <Input ref={inputRef} id="voice-recovery" value={command} onChange={(event) => setCommand(event.target.value)} className="h-11" />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={busy} className="min-h-11" onClick={review}>{label("Find products", "वस्तू शोधा")}</Button>
          <Button type="button" variant="ghost" className="min-h-11" onClick={() => { setCommand(""); setMessage(""); setNeedsCorrection(false); }}>{label("Clear", "काढा")}</Button>
        </div>
      </div>}

      {draft.length > 0 && <fieldset disabled={listening || busy} className="min-w-0 space-y-3 disabled:opacity-60">
        <legend className="sr-only">{label("Spoken order", "बोलून सांगितलेली ऑर्डर")}</legend>
        <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">{label("Spoken order", "बोलून सांगितलेली ऑर्डर")} · {formatNumber(draft.length)}</p>
            {draft.length > ready.length && <p className="mt-1 text-xs text-amber-700">
              {label(`${draft.length - ready.length} need a correction`, `${draft.length - ready.length} वस्तू तपासा`)}
            </p>}
          </div>
          <Button type="button" variant="ghost" className="min-h-11 text-slate-500" onClick={() => {
            setDraft([]); setCommand(""); setMessage(""); lastParsedIds.current.clear();
          }}>{label("Clear all", "सर्व काढा")}</Button>
        </div>

        {reviewed.map(({ line, result }) => {
          const selectedItem = items.find((item) => item.id === line.selectedId);
          const baseUnit = units.find((unit) => unit.id === selectedItem?.unitId)?.shortForm || "";
          const spokenUnit = line.requestedUnit || baseUnit;
          const inBill = addedItems.filter((item) => item.itemId === line.selectedId).reduce((sum, item) => sum + item.quantity, 0);
          const otherReady = ready.reduce((sum, entry) => entry.line.id !== line.id && entry.result.state === "ready" &&
            entry.result.saleLine.itemId === line.selectedId ? sum + entry.result.saleLine.quantity : sum, 0);
          const conversion = selectedItem ? convertVoiceQuantity(1, line.requestedUnit, baseUnit) : null;
          const max = maxSaleQuantity(Number(selectedItem?.quantity || 0), inBill + otherReady, conversion ?? 0);
          const canEditQuantity = selectedItem && conversion !== null &&
            (result.state === "ready" || result.state === "quantity" || (result.state === "insufficient" && max > 0));

          return <div key={line.id} className={`rounded-xl border bg-white p-3 ${result.state === "ready" ? "border-slate-200" : "border-amber-200"}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-semibold text-slate-900">{productName(selectedItem) || line.query}</p>
                {selectedItem && <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>{label("Stock:", "साठा:")} {formatNumber(Math.max(0, Number(selectedItem.quantity) - inBill))} {unitLabel(baseUnit)}</span>
                  <span className="font-medium text-blue-700">{label("Selling:", "विक्री:")} ₹{formatMoney(selectedItem.sellPrice)}/{unitLabel(baseUnit)}</span>
                  <span>{label("Buy:", "खरेदी:")} ₹{formatMoney(selectedItem.buyPrice)}/{unitLabel(baseUnit)}</span>
                </div>}
                {!selectedItem && <p className="mt-1 text-xs text-slate-500">
                  {formatNumber(line.quantity)} {unitLabel(spokenUnit)}
                </p>}
              </div>
              <div className="flex shrink-0 flex-col items-end">
                {result.state === "ready" && <span className="text-sm font-semibold tabular-nums">₹{formatMoney(result.saleLine.totalPrice)}</span>}
                <Button type="button" variant="ghost" size="icon" className="h-11 w-11 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-700"
                  aria-label={label(`Remove ${productName(selectedItem) || line.query}`, `${productName(selectedItem) || line.query} काढा`)}
                  onClick={() => removeDraftLine(line.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>

            {canEditQuantity && <div className="mt-3">
              <SaleQuantityControl value={line.quantityInput ?? String(line.quantity)} max={max} unit={unitLabel(spokenUnit)}
                label={label("Quantity", "Quantity")} productName={productName(selectedItem)} language="en"
                onChange={(value) => setDraft((current) => current.map((entry) => entry.id === line.id
                  ? { ...entry, quantityInput: value, quantity: Number(value) } : entry))} />
            </div>}

            {result.state === "expired" && <p className="mt-2 text-sm text-red-700">{label("Expired — choose a replacement.", "मुदत संपली — दुसरी वस्तू निवडा.")}</p>}
            {result.state === "insufficient" && !canEditQuantity && <p className="mt-2 text-sm text-red-700">{label("Out of stock for this bill.", "या बिलासाठी साठा उपलब्ध नाही.")}</p>}
            {result.state === "unit" && <div className="mt-2 space-y-2">
              <p className="text-sm text-amber-800">{label("This product is sold in", "ही वस्तू या एककात विकली जाते:")} {unitLabel(result.unitName)}.</p>
              <Button type="button" variant="outline" className="min-h-11 whitespace-normal" onClick={() => setDraft((current) => current.map((entry) =>
                entry.id === line.id ? { ...entry, requestedUnit: undefined } : entry))}>
                {label(`Use ${formatNumber(line.quantity)} ${unitLabel(result.unitName)}`, `${formatNumber(line.quantity)} ${unitLabel(result.unitName)} वापरा`)}
              </Button>
            </div>}
            {result.state === "variant" && <p className="mt-2 text-sm text-amber-800">
              {label("Choose the price or pack.", "किंमत किंवा पॅक निवडा.")}{line.priceOverride != null ? ` ₹${formatMoney(line.priceOverride)}` : ""}
            </p>}
            {result.state === "quantity" && !canEditQuantity && <p className="mt-2 text-sm text-amber-800">{label("Check the quantity and unit.", "प्रमाण आणि एकक तपासा.")}</p>}
            {result.state === "unmatched" && <div className="mt-2 space-y-2">
              <p className="text-sm text-amber-800">{line.candidates.length ? label("Which product?", "कोणती वस्तू?") : label("No matching product.", "जुळणारी वस्तू सापडली नाही.")}</p>
              {line.candidates.slice(0, 3).map((item) => <Button type="button" key={item.id} variant="outline"
                className="h-auto min-h-11 w-full justify-between gap-2 whitespace-normal rounded-lg text-left"
                onClick={() => choose(line.id, item.id)}>
                <span>{productName(item)}</span><span className="shrink-0">₹{formatMoney(item.sellPrice)}</span>
              </Button>)}
            </div>}

            {result.state !== "ready" && <div className="mt-2 flex flex-wrap gap-2">
              {(result.state === "variant" || (result.state === "quantity" && !canEditQuantity)) && onProductSelected && line.selectedId != null &&
                <Button type="button" variant="outline" className="min-h-11 whitespace-normal" onClick={() =>
                  onProductSelected(line.selectedId!, line.quantity, line.requestedUnit, () => removeDraftLine(line.id))}>
                  {label("Open product", "वस्तू उघडा")}
                </Button>}
              {onSearchRequested && (result.state === "expired" || result.state === "unmatched" || result.state === "insufficient") &&
                <Button type="button" variant="outline" className="min-h-11" onClick={() => searchInstead(line)}>
                  {result.state === "unmatched" ? label("Search products", "वस्तू शोधा") : label("Find replacement", "दुसरी वस्तू शोधा")}
                </Button>}
            </div>}
          </div>;
        })}

        {ready.length > 0 && <Button type="button" className="h-auto min-h-12 w-full gap-2 whitespace-normal rounded-xl bg-green-600 py-3 hover:bg-green-700"
          disabled={busy || listening} onClick={addConfirmed}>
          <span>{label(`Add ${ready.length} to bill`, `${ready.length} वस्तू बिलात जोडा`)}</span>
          <span className="ml-auto shrink-0 tabular-nums">₹{formatMoney(ready.reduce((sum, entry) =>
            sum + (entry.result.state === "ready" ? entry.result.saleLine.totalPrice : 0), 0))}</span>
        </Button>}
        {command && !needsCorrection && <details className="text-xs text-slate-500">
          <summary className="cursor-pointer py-3">{label("Correct spoken words", "ऐकलेले शब्द दुरुस्त करा")}</summary>
          <div className="mt-1 space-y-2">
            <Input className="h-11" aria-label={label("Correct spoken order", "ऐकलेले शब्द दुरुस्त करा")} value={command} onChange={(event) => setCommand(event.target.value)} />
            <Button type="button" variant="outline" className="min-h-11" disabled={busy || listening} onClick={review}>{label("Update products", "वस्तू अद्ययावत करा")}</Button>
          </div>
        </details>}
      </fieldset>}
    </section>
  );
}
