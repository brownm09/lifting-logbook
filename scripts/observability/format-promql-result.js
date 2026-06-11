// format-promql-result.js — pretty-print a Prometheus /api/v1/query JSON response.
//
// Reads the JSON body on stdin and prints a compact, sorted summary of the
// result vector (route label -> value). `jq` is not available in this
// environment (see CLAUDE.md), so this stands in for it.
//
// Used by run-calibration-queries.sh for the #468 APIRouteHighErrorRate
// calibration. Exits non-zero on a non-JSON body or a query error so the caller
// can flag the failure.

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch (e) {
    console.error('  ERROR: response was not JSON (first 400 chars):');
    console.error('  ' + raw.slice(0, 400).replace(/\n/g, '\n  '));
    process.exit(1);
  }

  if (doc.status !== 'success') {
    console.error('  ERROR: query status=' + doc.status +
      (doc.errorType ? ' (' + doc.errorType + ')' : '') +
      (doc.error ? ' — ' + doc.error : ''));
    process.exit(1);
  }

  const data = doc.data || {};
  const result = data.result || [];

  if (data.resultType === 'scalar') {
    console.log('  scalar: ' + (Array.isArray(data.result) ? data.result[1] : data.result));
    return;
  }

  if (!result.length) {
    console.log('  (no series returned)');
    return;
  }

  const rows = result.map((s) => {
    const metric = s.metric || {};
    let route;
    if (Object.prototype.hasOwnProperty.call(metric, 'http_route')) {
      route = metric.http_route === '' ? '(empty http_route)' : metric.http_route;
    } else {
      route = Object.keys(metric).length ? JSON.stringify(metric) : '(no labels)';
    }
    const val = Array.isArray(s.value) ? s.value[1] : '';
    return { route, val };
  });

  rows.sort((a, b) => a.route.localeCompare(b.route));
  const width = Math.min(60, Math.max(...rows.map((r) => r.route.length)));
  for (const r of rows) {
    console.log('  ' + r.route.padEnd(width) + '  ' + r.val);
  }
  console.log('  (' + rows.length + ' series)');
});
