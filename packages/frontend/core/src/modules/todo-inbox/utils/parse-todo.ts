export type TodoRepeat = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type TodoBucket = 'overdue' | 'today' | 'week' | 'later' | 'none';

export interface ParsedTodo {
  checked: boolean;
  /** Text with the due/repeat tokens removed. */
  title: string;
  /** Local date `YYYY-MM-DD`, or null. */
  due: string | null;
  repeat: TodoRepeat | null;
}

const TODO_LINE = /^\s*(?:[-*+]|\d+\.)\s+\[( |x|X)\]\s?(.*)$/;
const ISO_DUE = /(?:^|\s)@(\d{4})-(\d{2})-(\d{2})(?=\s|$)/;
const WORD_DUE = /(?:^|\s)@(h[oô]m nay|today|ng[aà]y mai|tomorrow)(?=\s|$)/iu;
const REPEAT =
  /(?:^|\s)(?:🔁|repeat:)\s*(h[aà]ng ng[aà]y|h[aà]ng tu[aầ]n|h[aà]ng th[aá]ng|h[aà]ng n[aă]m|daily|weekly|monthly|yearly)(?=\s|$)/iu;

const REPEAT_MAP: Record<string, TodoRepeat> = {
  'hàng ngày': 'daily',
  'hang ngay': 'daily',
  daily: 'daily',
  'hàng tuần': 'weekly',
  'hang tuan': 'weekly',
  weekly: 'weekly',
  'hàng tháng': 'monthly',
  'hang thang': 'monthly',
  monthly: 'monthly',
  'hàng năm': 'yearly',
  'hang nam': 'yearly',
  yearly: 'yearly',
};

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isValidDate(y: number, m: number, d: number) {
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}

/**
 * Parses one markdown line of a task list item. Returns null if the line is
 * not a checkbox. `now` resolves relative words such as `@today`.
 */
export function parseTodo(
  markdown: string,
  now: Date = new Date()
): ParsedTodo | null {
  const firstLine = markdown.split('\n').find(line => line.trim() !== '');
  const match = firstLine ? TODO_LINE.exec(firstLine) : null;
  if (!match) return null;
  return parseTodoText(match[2], match[1].toLowerCase() === 'x', now);
}

/** Parses the plain text of a checkbox block (due/repeat tokens inline). */
export function parseTodoText(
  source: string,
  checked: boolean,
  now: Date = new Date()
): ParsedTodo {
  let text = source;
  let due: string | null = null;
  let repeat: TodoRepeat | null = null;

  const iso = ISO_DUE.exec(text);
  if (iso) {
    const [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    if (isValidDate(y, m, d)) {
      due = `${iso[1]}-${iso[2]}-${iso[3]}`;
      text = text.replace(ISO_DUE, '');
    }
  } else {
    const word = WORD_DUE.exec(text);
    if (word) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (/^(ng[aà]y mai|tomorrow)$/iu.test(word[1])) {
        date.setDate(date.getDate() + 1);
      }
      due = formatDate(date);
      text = text.replace(WORD_DUE, '');
    }
  }

  const rep = REPEAT.exec(text);
  if (rep) {
    repeat = REPEAT_MAP[rep[1].toLowerCase()] ?? null;
    if (repeat) text = text.replace(REPEAT, '');
  }

  return {
    checked,
    title: text.replace(/\s+/g, ' ').trim(),
    due,
    repeat,
  };
}

export function bucketOf(
  due: string | null,
  now: Date = new Date()
): TodoBucket {
  if (!due) return 'none';
  const today = formatDate(now);
  if (due < today) return 'overdue';
  if (due === today) return 'today';
  const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  weekEnd.setDate(weekEnd.getDate() + 7);
  return due <= formatDate(weekEnd) ? 'week' : 'later';
}

/** Next occurrence of a repeating task, strictly after `due`. */
export function nextDue(due: string, repeat: TodoRepeat): string {
  const date = parseDate(due);
  const day = date.getDate();
  switch (repeat) {
    case 'daily':
      date.setDate(day + 1);
      break;
    case 'weekly':
      date.setDate(day + 7);
      break;
    case 'monthly': {
      date.setDate(1);
      date.setMonth(date.getMonth() + 1);
      const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      date.setDate(Math.min(day, last.getDate()));
      break;
    }
    case 'yearly': {
      date.setDate(1);
      date.setFullYear(date.getFullYear() + 1);
      const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      date.setDate(Math.min(day, last.getDate()));
      break;
    }
  }
  return formatDate(date);
}
