// format-tempo-result.js — pretty-print a Grafana Cloud Tempo read-API JSON response.
//
// `jq` is not available in this environment (see CLAUDE.md), so this stands in for it.
// Reads the JSON body on stdin; the response SHAPE is passed as argv[2]:
//   search | trace | tags | tag-values
// Used by tempo-query.sh (#829). Exits non-zero on a non-JSON body or an API error so
// the caller can flag the failure.

const shape = process.argv[2] || 'auto';
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => {
  raw = raw.trim();
  if (!raw) { console.log('  (empty response)'); return; }

  let doc;
  try {
    doc = JSON.parse(raw);
  } catch (e) {
    console.error('  ERROR: response was not JSON (first 400 chars):');
    console.error('  ' + raw.slice(0, 400).replace(/\n/g, '\n  '));
    process.exit(1);
  }

  // Tempo surfaces query errors either as a plain-text body (caught above) or as JSON
  // with an `error` / `message` field and no result payload.
  if (doc && typeof doc === 'object' &&
      (doc.error || (doc.message && !doc.traces && !doc.batches && !doc.resourceSpans))) {
    console.error('  ERROR: ' + (doc.error || doc.message));
    process.exit(1);
  }

  try {
    if (shape === 'search') return printSearch(doc);
    if (shape === 'trace') return printTrace(doc);
    if (shape === 'tags') return printTags(doc);
    if (shape === 'tag-values') return printTagValues(doc);
    printRaw(doc);
  } catch (e) {
    console.error('  (could not format response as ' + shape + '; raw JSON below)');
    printRaw(doc);
  }
});

function printRaw(doc) {
  console.log(JSON.stringify(doc, null, 2).split('\n').map((l) => '  ' + l).join('\n'));
}

// OTLP AnyValue shape: { stringValue | intValue | boolValue | doubleValue | ... }.
// TraceQL search results use a flatter { key, value } with a scalar value.
function attrValue(v) {
  if (v == null) return '';
  if (typeof v !== 'object') return String(v);
  if ('stringValue' in v) return v.stringValue;
  if ('intValue' in v) return String(v.intValue);
  if ('boolValue' in v) return String(v.boolValue);
  if ('doubleValue' in v) return String(v.doubleValue);
  return JSON.stringify(v);
}

function printSearch(doc) {
  const traces = doc.traces || [];
  if (!traces.length) { console.log('  (no traces matched)'); return; }
  for (const t of traces) {
    const svc = t.rootServiceName || '(no root service)';
    const name = t.rootTraceName || '';
    const dur = t.durationMs != null ? t.durationMs + 'ms' : '';
    console.log(('  ' + t.traceID + '  ' + svc + ' ' + name + ' ' + dur).trimEnd());
    // Surface matched span attributes — the payload span-tag validation cares about.
    const spanSets = t.spanSets || (t.spanSet ? [t.spanSet] : []);
    for (const ss of spanSets) {
      for (const sp of ss.spans || []) {
        const attrs = (sp.attributes || [])
          .map((a) => a.key + '=' + attrValue(a.value))
          .join(' ');
        const bits = [];
        if (sp.name) bits.push(sp.name);
        if (attrs) bits.push(attrs);
        if (bits.length) console.log('      - ' + bits.join('  '));
      }
    }
  }
  console.log('  (' + traces.length + ' trace' + (traces.length === 1 ? '' : 's') + ')');
}

function printTrace(doc) {
  // Tempo returns OTLP JSON: { batches: [ { resource, scopeSpans:[{spans:[...]}] } ] }
  // (older builds: { resourceSpans: [...] } / instrumentationLibrarySpans).
  const batches = doc.batches || doc.resourceSpans || [];
  if (!batches.length) { console.log('  (trace has no spans / not found)'); return; }
  let spanCount = 0;
  const services = new Set();
  for (const b of batches) {
    const rattrs = (b.resource && b.resource.attributes) || [];
    const svcAttr = rattrs.find((a) => a.key === 'service.name');
    if (svcAttr) services.add(attrValue(svcAttr.value));
    const scopeSpans = b.scopeSpans || b.instrumentationLibrarySpans || [];
    for (const ss of scopeSpans) spanCount += (ss.spans || []).length;
  }
  const svcList = [...services].join(', ') || '(unknown)';
  console.log('  trace: ' + spanCount + ' span(s) across service(s): ' + svcList);
  console.log('  (use search / tag-values for tag-level assertions; full OTLP payload suppressed)');
}

function printTags(doc) {
  // v1: { tagNames: [...] }.  v2: { scopes: [ { name, tags: [...] } ] }.
  let names = [];
  if (Array.isArray(doc.tagNames)) {
    names = doc.tagNames;
  } else if (Array.isArray(doc.scopes)) {
    names = doc.scopes.flatMap((s) =>
      (s.tags || []).map((t) => (s.name ? s.name + '.' : '') + t));
  }
  if (!names.length) { console.log('  (no tags returned)'); return; }
  names = [...new Set(names)].sort();
  for (const n of names) console.log('  ' + n);
  console.log('  (' + names.length + ' tag' + (names.length === 1 ? '' : 's') + ')');
}

function printTagValues(doc) {
  // v1: { tagValues: ["a","b"] }.  v2: { tagValues: [ { type, value } ] }.
  let vals = doc.tagValues || [];
  vals = vals.map((v) => (v && typeof v === 'object' ? v.value : v));
  if (!vals.length) { console.log('  (no values returned)'); return; }
  vals = [...new Set(vals)].sort();
  for (const v of vals) console.log('  ' + v);
  console.log('  (' + vals.length + ' value' + (vals.length === 1 ? '' : 's') + ')');
}
