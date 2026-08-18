/**
 * Deterministic JSON serialization.
 *
 * Node.js has no equivalent of Python's `json.dumps(obj, sort_keys=True)`, so we
 * sort object keys recursively before serializing. This is what guarantees that
 * running an extractor twice on the same week produces a byte-identical file.
 */

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      sorted[key] = sortValue(source[key]);
    }
    return sorted;
  }

  return value;
}

export function stableStringify(value: unknown, indent = 2): string {
  return JSON.stringify(sortValue(value), null, indent) + '\n';
}
