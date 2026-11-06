export type ToolArgs = Record<string, unknown>;

export function readString(
  args: ToolArgs,
  key: string,
  { required = false, max = 200_000 }: { required?: boolean; max?: number } = {}
): string | undefined {
  const value = args[key];
  if (value === undefined || value === null || value === '') {
    if (required) throw new Error(`Thiếu tham số "${key}"`);
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new Error(`Tham số "${key}" phải là chuỗi`);
  }
  if (value.length > max) {
    throw new Error(`Tham số "${key}" quá dài (tối đa ${max} ký tự)`);
  }
  return value;
}

export function readInt(
  args: ToolArgs,
  key: string,
  { min, max, fallback }: { min: number; max: number; fallback: number }
): number {
  const value = args[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Tham số "${key}" phải là số`);
  }
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

export function readBool(args: ToolArgs, key: string, fallback: boolean) {
  const value = args[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'boolean') {
    throw new Error(`Tham số "${key}" phải là true hoặc false`);
  }
  return value;
}

export function readEnum<T extends string>(
  args: ToolArgs,
  key: string,
  allowed: readonly T[]
): T | undefined {
  const value = readString(args, key);
  if (value === undefined) return undefined;
  if (!allowed.includes(value as T)) {
    throw new Error(
      `Tham số "${key}" phải là một trong: ${allowed.join(', ')}`
    );
  }
  return value as T;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function readIsoDate(args: ToolArgs, key: string): string | undefined {
  const value = readString(args, key);
  if (value === undefined) return undefined;
  const match = ISO_DATE.exec(value);
  const valid =
    match &&
    (() => {
      const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
      const date = new Date(y, m - 1, d);
      return (
        date.getFullYear() === y &&
        date.getMonth() === m - 1 &&
        date.getDate() === d
      );
    })();
  if (!valid) throw new Error(`Tham số "${key}" phải có dạng YYYY-MM-DD`);
  return value;
}

/** A markdown checkbox line using the inbox syntax (`@date`, `repeat:rule`). */
export function buildTaskLine(options: {
  text: string;
  due?: string;
  repeat?: string;
}): string {
  const text = options.text.replace(/\s+/g, ' ').trim();
  if (!text) throw new Error('Nội dung việc không được để trống');
  const parts = [`- [ ] ${text}`];
  if (options.due) parts.push(`@${options.due}`);
  if (options.repeat) parts.push(`repeat:${options.repeat}`);
  return parts.join(' ');
}

/** Short, single-line summary of tool arguments for the audit log. */
export function summarizeArgs(args: unknown, max = 120): string {
  let text: string;
  try {
    text = JSON.stringify(args) ?? '';
  } catch {
    text = String(args);
  }
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
