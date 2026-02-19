let jsonMode = false;

export function setJsonMode(val: boolean): void {
  jsonMode = val;
}

export function isJsonMode(): boolean {
  return jsonMode;
}

export function print(data: unknown): void {
  if (jsonMode) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  }
}

const MAX_COL = 50;

function truncate(val: string): string {
  return val.length > MAX_COL ? val.slice(0, MAX_COL - 1) + '…' : val;
}

export function printTable(
  rows: Record<string, unknown>[],
  columns: string[]
): void {
  if (jsonMode) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  if (rows.length === 0) {
    console.log('(no results)');
    return;
  }

  // Calculate column widths
  const widths: Record<string, number> = {};
  for (const col of columns) {
    widths[col] = col.length;
  }
  for (const row of rows) {
    for (const col of columns) {
      const val = truncate(String(row[col] ?? ''));
      widths[col] = Math.max(widths[col], val.length);
    }
  }

  const header = columns.map(c => c.toUpperCase().padEnd(widths[c])).join('  ');
  const divider = columns.map(c => '─'.repeat(widths[c])).join('  ');
  console.log(header);
  console.log(divider);

  for (const row of rows) {
    const line = columns
      .map(c => truncate(String(row[c] ?? '')).padEnd(widths[c]))
      .join('  ');
    console.log(line);
  }
}

export function printError(code: string, message: string, status?: number): void {
  process.stderr.write(`[${code}] ${message}\n`);
  if (jsonMode) {
    const errObj: Record<string, unknown> = { error: message, code };
    if (status !== undefined) errObj.status = status;
    console.log(JSON.stringify(errObj, null, 2));
  }
}
