/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : scripts/lib/pretty.js – helper for demo.sh: pretty-print / pick fields from JSON on stdin
 *
 * Usage:  curl ... | node scripts/lib/pretty.js            → pretty JSON (arrays trimmed to 3 items)
 *         curl ... | node scripts/lib/pretty.js get token  → print one field (dot path)
 */
let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  let data;
  try {
    data = JSON.parse(input);
  } catch {
    process.stdout.write(input);
    return;
  }

  const [mode, path] = process.argv.slice(2);
  if (mode === 'get') {
    const value = path.split('.').reduce((node, key) => (node == null ? undefined : node[key]), data);
    process.stdout.write(value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value));
    return;
  }

  // Trim long arrays, long tokens and noisy fields so the output fits on a screenshot.
  const NOISY = new Set(['createdAt', 'updatedAt', 'receivedAt', 'statusHistory', '__v']);
  const trim = (node) => {
    if (Array.isArray(node)) {
      const items = node.slice(0, 3).map(trim);
      if (node.length > 3) items.push(`… ${node.length - 3} more`);
      return items;
    }
    if (node && typeof node === 'object') {
      return Object.fromEntries(
        Object.entries(node)
          .filter(([k]) => !NOISY.has(k))
          // GeoJSON duplicates position/lat+lng – keep only the readable form.
          .filter(([k]) => k !== 'location' || !(node.position || node.lat !== undefined))
          .map(([k, v]) => [k, k === 'token' && typeof v === 'string' ? `${v.slice(0, 40)}…` : trim(v)])
      );
    }
    return node;
  };
  console.log(JSON.stringify(trim(data), null, 2));
});
