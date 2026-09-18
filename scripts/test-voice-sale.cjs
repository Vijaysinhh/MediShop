const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Compile the actual TypeScript modules in memory; no generated files or services.
const modules = new Map();
function load(name) {
  const filename = path.resolve(__dirname, '..', 'lib', `${name}.ts`);
  if (modules.has(filename)) return modules.get(filename);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', source)(
    (id) => id.startsWith('./') ? load(id.slice(2)) : require(id), module, module.exports,
  );
  modules.set(filename, module.exports);
  return module.exports;
}
const { parseVoiceSaleCommand: parse, normalizeVoiceText: normalize, cleanVoiceRepetitions: cleanRepeats } = load('voice-sale-parser');
const { matchVoiceProducts: match, convertVoiceQuantity: convert, checkVoiceStock: stock } = load('voice-sale-matching');
const { createVoiceRecording } = load('voice-recording');
const { isEnabledFlag } = load('feature-flags');

for (const [spoken, expected] of [
  ['two Parle-G', [{quantity: 2, productQuery: 'parle g'}]],
  ['एक एक एक एक एक बिस्किट', [{quantity: 1, productQuery: 'बिस्किट'}]],
  ['one १ एक 1 ek बिस्किट', [{quantity: 1, productQuery: 'बिस्किट'}]],
  ['दोन दोन दोन दूध', [{quantity: 2, productQuery: 'दूध'}]],
  ['दोन 2 दोन दूध', [{quantity: 2, productQuery: 'दूध'}]],
  ['एक-एक-एक बिस्किट', [{quantity: 1, productQuery: 'बिस्किट'}]],
  ['one (one) one biscuit', [{quantity: 1, productQuery: 'biscuit'}]],
  ['एक\u200D एक\u200C १\u2060 ek बिस्किट', [{quantity: 1, productQuery: 'बिस्किट'}]],
  ['एक\u200Bएक\u200Bबिस्किट', [{quantity: 1, productQuery: 'बिस्किट'}]],
  ['एक… एक... एक बिस्किट बिस्किट', [{quantity: 1, productQuery: 'बिस्किट'}]],
  ['दोन दोन दूध दूध आणि एक एक bread bread', [{quantity: 2, productQuery: 'दूध'}, {quantity: 1, productQuery: 'bread'}]],
  ['अर्धा अर्धा लिटर लिटर दूध दूध', [{quantity: 0.5, productQuery: 'दूध', requestedUnit: 'l'}]],
  ['१.५ 1.5 किलो साखर', [{quantity: 1.5, productQuery: 'साखर', requestedUnit: 'kg'}]],
  ['दोन दोन दोन दोन रुपयांचे बिस्किट', [{quantity: 2, productQuery: 'बिस्किट', priceOverride: 2}]],
  ['दोन दोन ₹२ बिस्किट', [{quantity: 2, productQuery: 'बिस्किट', priceOverride: 2}]],
  ['दोन दोन रुपयांचे बिस्किट', [{quantity: 2, productQuery: 'बिस्किट', priceOverride: 2}]],
  ['दोन दूध आणि दोन दूध', [{quantity: 2, productQuery: 'दूध'}, {quantity: 2, productQuery: 'दूध'}]],
  ['दोन दूध आणि आणखी दोन दूध', [{quantity: 2, productQuery: 'दूध'}, {quantity: 2, productQuery: 'दूध'}]],
  ['दोन पार्ले जी आणि अर्धा लिटर दूध', [
    { quantity: 2, productQuery: 'पार्ले जी' },
    { quantity: 0.5, productQuery: 'दूध', requestedUnit: 'l' },
  ]],
  ['१.५ किलो साखर, २५० ग्रॅम चहा', [
    { quantity: 1.5, productQuery: 'साखर', requestedUnit: 'kg' },
    { quantity: 250, productQuery: 'चहा', requestedUnit: 'g' },
  ]],
  ['दूध आणि ब्रेड', [{quantity: 1, productQuery: 'दूध'}, {quantity: 1, productQuery: 'ब्रेड'}]],
  ['दूध\nब्रेड', [{quantity: 1, productQuery: 'दूध'}, {quantity: 1, productQuery: 'ब्रेड'}]],
  ['दूध;ब्रेड', [{quantity: 1, productQuery: 'दूध'}, {quantity: 1, productQuery: 'ब्रेड'}]],
  ['दूध दोन लिटर', [{quantity: 2, productQuery: 'दूध', requestedUnit: 'l'}]],
  ['एक डझन अंडी', [{quantity: 1, productQuery: 'अंडी', requestedUnit: 'dozen'}]],
  ['शून्य दूध', [{quantity: 0, productQuery: 'दूध'}]],
  ['दोन दहा रुपयांचे पार्ले जी', [{quantity: 2, productQuery: 'पार्ले जी', priceOverride: 10}]],
  ['दोन पाव', [{quantity: 2, productQuery: 'पाव'}]],
  ['पाव किलो साखर', [{quantity: 0.25, productQuery: 'साखर', requestedUnit: 'kg'}]],
  ['two bread and half a litre of milk', [{quantity: 2, productQuery: 'bread'}, {quantity: 0.5, productQuery: 'milk', requestedUnit: 'l'}]],
  ['दोन दूध तीन ब्रेड', [{quantity: 2, productQuery: 'दूध'}, {quantity: 3, productQuery: 'ब्रेड'}]],
]) test(`parses: ${spoken}`, () => assert.deepEqual(parse(spoken), expected));

test('matches both scripts and preserves brand ambiguity', () => {
  const products = [{id: 1, name: 'Milk', brand: 'A'}, {id: 2, name: 'Milk', brand: 'B'}, {id: 3, name: 'Biscuits', brand: 'Parle-G'}];
  assert.equal(match('दूध', products).selectedId, null);
  assert.equal(match('दूध', products).candidates.length, 2);
  assert.equal(match('पार्ले जी बिस्किटे', products).selectedId, 3);
  assert.equal(match('Milk A', products).selectedId, 1);
  assert.equal(match('unknown', products).selectedId, null);
  assert.equal(normalize('Parle-G'), normalize('पार्ले जी'));
});
test('converts compatible units once, rejects guessed pack sizes', () => {
  assert.equal(convert(250, 'g', 'kg'), 0.25);
  assert.equal(convert(0.5, 'l', 'ml'), 500);
  assert.equal(convert(1, 'dozen', 'pcs'), 12);
  assert.equal(convert(1, 'dozen', 'dz'), 1);
  assert.equal(convert(2, 'packet', 'pack'), 2);
  assert.equal(convert(1, 'kg', 'packet'), null);
  assert.equal(convert(1, 'box', 'pcs'), null);
  assert.equal(convert(0, undefined, 'pcs'), null);
  assert.equal(convert(NaN, undefined, 'pcs'), null);
});

function harness(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const engines = [], texts = [], stableTexts = [], finished = [], statuses = [], errors = [];
  const recording = createVoiceRecording(() => {
    const engine = { start() {}, stop() {}, abort() {}, onresult: null, onend: null, onerror: null };
    engines.push(engine);
    return engine;
  }, 'mr-IN', { onText: (text) => texts.push(text), onStableText: (text) => stableTexts.push(text), onFinish: (text, status) => { finished.push(text); statuses.push(status); }, onError: (code) => errors.push(code) });
  recording.start();
  const result = (engine, phrases) => engine.onresult({ results: phrases.map(([text, final = true]) => ({ isFinal: final, 0: { transcript: text } })) });
  return {recording, engines, texts, stableTexts, finished, statuses, errors, result};
}
test('stock checks include bill quantities, pending quantities and expiry', () => {
  const now = new Date(2026, 8, 7, 12);
  assert.equal(stock({quantity: 0}, 1, 0, 0, now).state, 'insufficient');
  assert.deepEqual(stock({quantity: 4}, 2, 2, 1, now), {state: 'insufficient', available: 1});
  assert.equal(stock({quantity: 4, expiryDate: new Date(2026, 8, 6)}, 1, 0, 0, now).state, 'expired');
  assert.equal(stock({quantity: 4, expiryDate: new Date(2026, 8, 7)}, 1, 0, 0, now).state, 'ready');
  assert.equal(stock({quantity: 4, expiryDate: 'bad-date'}, 1, 0, 0, now).state, 'invalid');
  assert.equal(stock({quantity: 0.3}, 0.2, 0.1, 0, now).state, 'ready');
  assert.equal(stock({quantity: NaN}, 1, 0, 0, now).state, 'invalid');
});
test('result revisions never duplicate a product; Done processes once', (t) => {
  const h = harness(t), engine = h.engines[0];
  assert.equal(engine.lang, 'mr-IN');
  assert.equal(engine.continuous, false);
  assert.equal(engine.interimResults, true);
  h.result(engine, [['दोन दूध', false]]);
  h.result(engine, [['दोन दूध'], ['एक ब्रेड', false]]);
  h.result(engine, [['दोन दूध'], ['एक ब्रेड']]);
  h.recording.stop(); engine.onend();
  t.mock.timers.tick(2000);
  assert.deepEqual(h.finished, ['दोन दूध एक ब्रेड']);
});

test('Marathi quantity loops are cleaned live, not only when parsing', (t) => {
  const h = harness(t), engine = h.engines[0];
  h.result(engine, [['एक', false]]);
  h.result(engine, [['एक एक', false]]);
  h.result(engine, [['एक एक एक एक एक', false]]);
  h.result(engine, [['एक एक एक एक एक बिस्किट', false]]);
  h.result(engine, [['एक एक एक एक एक बिस्किट']]);
  assert.deepEqual(h.texts, ['एक', 'एक बिस्किट']);
  h.recording.stop(); engine.onend();
  assert.deepEqual(h.finished, ['एक बिस्किट']);
  assert.deepEqual(parse(h.finished[0]), [{quantity: 1, productQuery: 'बिस्किट'}]);
});

test('repeated quantity fragments across result slots remain one quantity', (t) => {
  const h = harness(t), engine = h.engines[0];
  h.result(engine, [['एक'], ['एक']]);
  h.result(engine, [['एक'], ['एक'], ['one'], ['१ एक बिस्किट']]);
  h.recording.stop(); engine.onend();
  assert.deepEqual(h.finished, ['एक बिस्किट']);
});

test('quantity corrections can replace a previously displayed interim quantity', (t) => {
  const h = harness(t), engine = h.engines[0];
  h.result(engine, [['एक एक बिस्किट', false]]);
  h.result(engine, [['दोन बिस्किट']]);
  assert.deepEqual(h.texts, ['एक बिस्किट', 'दोन बिस्किट']);
  h.recording.stop(); engine.onend();
  assert.deepEqual(h.finished, ['दोन बिस्किट']);
});

test('cleanup preserves explicit additional items, price variants and product names', () => {
  for (const text of ['दोन दूध आणि आणखी दोन दूध', 'एक बिस्किट एक बिस्किट', 'दोन दोन रुपयांचे बिस्किट', 'एक, एक बिस्किट', 'एक\nएक बिस्किट', 'Good Good biscuit', '50-50 biscuit', 'पाव पाव', 'दूध, दूध', 'दूध आणि दूध']) {
    assert.equal(cleanRepeats(text), text);
  }
  assert.equal(cleanRepeats('One १ एक ek बिस्किट'), 'One बिस्किट');
});

test('new price context is retained even if the earlier interim text was cleaned', (t) => {
  const h = harness(t), engine = h.engines[0];
  h.result(engine, [['दोन दोन', false]]);
  h.result(engine, [['दोन दोन रुपयांचे बिस्किट']]);
  assert.deepEqual(h.texts, ['दोन', 'दोन दोन रुपयांचे बिस्किट']);
});
test('one session captures a multi-item order and finishes without another tap', (t) => {
  const h = harness(t), engine = h.engines[0];
  h.result(engine, [['दोन दूध', false]]);
  h.result(engine, [['दोन दूध एक ब्रेड']]);
  engine.onend();
  t.mock.timers.tick(125000);
  assert.equal(h.engines.length, 1);
  assert.deepEqual(h.finished, ['दोन दूध एक ब्रेड']);
  assert.deepEqual(h.errors, []);
});
test('Done after the browser finishes does not reopen mic or process twice', (t) => {
  const h = harness(t);
  h.result(h.engines[0], [['दूध']]); h.engines[0].onend();
  h.recording.stop(); t.mock.timers.tick(1000);
  assert.equal(h.engines.length, 1);
  assert.deepEqual(h.finished, ['दूध']);
});
test('Cancel ignores queued callbacks and clears recording timers', (t) => {
  const h = harness(t), result = h.engines[0].onresult, end = h.engines[0].onend;
  h.recording.cancel(); end();
  result({ results: [{isFinal: true, 0: {transcript: 'late'}}] });
  t.mock.timers.tick(125000);
  assert.equal(h.engines.length, 1);
  assert.deepEqual(h.finished, []);
  assert.deepEqual(h.errors, []);
  assert.deepEqual(h.texts, []);
});
test('network errors preserve text and do not add partial orders', (t) => {
  const h = harness(t);
  h.result(h.engines[0], [['दूध']]);
  h.engines[0].onerror({error: 'network'});
  t.mock.timers.tick(125000);
  assert.deepEqual(h.texts, ['दूध']);
  assert.deepEqual(h.errors, ['network']);
  assert.deepEqual(h.finished, []);
});
test('Done completes even if browser never sends end', (t) => {
  const h = harness(t);
  h.result(h.engines[0], [['दूध']]); h.recording.stop();
  t.mock.timers.tick(1500);
  assert.deepEqual(h.finished, ['दूध']);
});
test('recordings have a finite lifetime', (t) => {
  const h = harness(t);
  t.mock.timers.tick(120000);
  assert.deepEqual(h.errors, ['time-limit']);
  assert.deepEqual(h.finished, []);
});

test('unstable guesses never appear as confirmed text', (t) => {
  const h = harness(t), engine = h.engines[0];
  h.result(engine, [['एक एक एक', false]]);
  h.result(engine, [['दोन बिस्किट', false]]);
  assert.deepEqual(h.stableTexts, []);
  h.result(engine, [['दोन बिस्किट']]);
  assert.deepEqual(h.stableTexts, ['दोन बिस्किट']);
});
test('unfinished speech is saved for review, never carried into a restart', (t) => {
  const h = harness(t), engine = h.engines[0];
  h.result(engine, [['एक बिस्किट'], ['दोन दोन', false]]);
  engine.onend(); t.mock.timers.tick(2000);
  assert.equal(h.engines.length, 1);
  assert.deepEqual(h.finished, ['एक बिस्किट दोन']);
  assert.deepEqual(h.statuses, [{needsReview: true}]);
});
test('repeated events commit final slots only once', (t) => {
  const h = harness(t), engine = h.engines[0];
  h.result(engine, [['एक बिस्किट']]);
  h.result(engine, [['एक बिस्किट']]);
  h.result(engine, [['एक बिस्किट'], ['दोन दूध']]);
  h.result(engine, [['एक बिस्किट'], ['दोन दूध']]);
  h.recording.stop(); engine.onend();
  assert.deepEqual(h.finished, ['एक बिस्किट दोन दूध']);
  assert.deepEqual(h.statuses, [{needsReview: false}]);
});
test('removed interim guesses do not survive the next snapshot', (t) => {
  const h = harness(t), engine = h.engines[0];
  h.result(engine, [['एक बिस्किट'], ['दोन दूध', false]]);
  h.result(engine, [['एक बिस्किट']]);
  h.recording.stop(); engine.onend();
  assert.deepEqual(h.finished, ['एक बिस्किट']);
  assert.deepEqual(h.statuses, [{needsReview: false}]);
});
test('Done timeout requires review when only an interim guess exists', (t) => {
  const h = harness(t), engine = h.engines[0];
  h.result(engine, [['एक एक बिस्किट', false]]);
  h.recording.stop(); t.mock.timers.tick(1500);
  assert.deepEqual(h.finished, ['एक बिस्किट']);
  assert.deepEqual(h.statuses, [{needsReview: true}]);
});
test('confirmed orders finish immediately and detach late browser callbacks', (t) => {
  const h = harness(t), engine = h.engines[0], end = engine.onend, result = engine.onresult;
  h.result(engine, [['दूध']]); end();
  assert.deepEqual(h.finished, ['दूध']);
  assert.equal(engine.onresult, null);
  assert.equal(engine.onend, null);
  result({results: [{isFinal: true, 0: {transcript: 'दूध दूध'}}]});
  end(); h.recording.start();
  t.mock.timers.tick(125000);
  assert.equal(h.engines.length, 1);
  assert.deepEqual(h.finished, ['दूध']);
  assert.deepEqual(h.statuses, [{needsReview: false}]);
});
test('no-speech ends once without depending on a browser end event', (t) => {
  const h = harness(t), end = h.engines[0].onend;
  h.engines[0].onerror({error: 'no-speech'});
  end(); t.mock.timers.tick(125000);
  assert.equal(h.engines.length, 1);
  assert.deepEqual(h.finished, ['']);
  assert.deepEqual(h.errors, []);
});
test('cleaning is idempotent and retains order separators', () => {
  for (const [input, expected] of [
    ['एक एक, एक एक बिस्किट', 'एक, एक बिस्किट'],
    ['दूध दूध;ब्रेड ब्रेड', 'दूध;ब्रेड'],
    ['एक\u200D एक\u200C बिस्किट बिस्किट', 'एक बिस्किट'],
    ['दोन दोन दोन दोन रुपयांचे बिस्किट', 'दोन दोन रुपयांचे बिस्किट'],
    ['दोन दूध आणि आणखी दोन दूध', 'दोन दूध आणि आणखी दोन दूध'],
  ]) {
    assert.equal(cleanRepeats(input), expected);
    assert.equal(cleanRepeats(cleanRepeats(input)), expected);
    assert.deepEqual(parse(input), parse(expected));
  }
});
test('noisy recording is cleaned, parsed and matched before checking stock', (t) => {
  const h = harness(t), engine = h.engines[0];
  const products = [{id: 1, name: 'Milk', quantity: 4}, {id: 2, name: 'Biscuits', brand: 'Parle-G', quantity: 3}];
  h.result(engine, [['एक एक', false]]);
  h.result(engine, [['एक एक एक\u200D बिस्किट बिस्किट आणि दोन 2 दोन दूध दूध']]);
  engine.onend();
  assert.deepEqual(h.finished, ['एक बिस्किट आणि दोन दूध']);
  const requests = parse(h.finished[0]);
  const lines = requests.map((request) => {
    const item = products.find((item) => item.id === match(request.productQuery, products).selectedId);
    assert.ok(item);
    assert.equal(stock(item, request.quantity, 0, 0).state, 'ready');
    return {itemId: item.id, quantity: request.quantity};
  });
  assert.deepEqual(lines, [{itemId: 2, quantity: 1}, {itemId: 1, quantity: 2}]);
});
test('long numeric loops do not multiply quantities, including with an explicit extra item', () => {
  const requests = parse(`${'दोन 2 two २ '.repeat(125)}दूध आणि आणखी दोन दूध`);
  assert.deepEqual(requests, [{quantity: 2, productQuery: 'दूध'}, {quantity: 2, productQuery: 'दूध'}]);
  assert.equal(requests.reduce((sum, request) => sum + request.quantity, 0), 4);
});
test('voice matching has no AI service dependency', () => {
  const component = fs.readFileSync(path.resolve(__dirname, '../components/voice-sale-assistant.tsx'), 'utf8');
  assert.doesNotMatch(component, /fetch\s*\(|voice-sale-ai|GoogleGenAI/);
  assert.equal(fs.existsSync(path.resolve(__dirname, '../app/api/voice-sale/resolve/route.ts')), false);
});
test('voice sale release flag is opt-in and gates the Sell page', () => {
  assert.equal(isEnabledFlag(undefined), false);
  assert.equal(isEnabledFlag('false'), false);
  assert.equal(isEnabledFlag('1'), false);
  assert.equal(isEnabledFlag(' TRUE '), true);
  const saleSearch = fs.readFileSync(path.resolve(__dirname, '../components/sales-item-search.tsx'), 'utf8');
  assert.match(saleSearch, /voiceSaleEnabled\s*&&\s*<VoiceSaleAssistant/);
  assert.match(saleSearch, /voiceSaleEnabled\s*&&\s*voiceReplacement/);
});
