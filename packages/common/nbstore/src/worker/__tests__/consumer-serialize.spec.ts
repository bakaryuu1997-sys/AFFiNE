import 'fake-indexeddb/auto';

import { describe, expect, it } from 'vitest';

import { StoreManagerConsumer } from '../consumer';

describe('StoreManagerConsumer serialization watchdog', () => {
  it('does not deadlock subsequent operations when a previous operation hangs', async () => {
    const consumer = new StoreManagerConsumer([] as any);
    consumer.watchdogTimeoutMs = 100; // Use small timeout for fast unit tests

    let op2Executed = false;

    // Simulate an operation that hangs indefinitely (e.g. aborted page reload in WebView2)
    (consumer as any).serialize('test-key', () => new Promise<never>(() => {}));

    // Next operation should NOT be blocked forever; with the watchdog timeout, it must execute
    const op2Promise = (consumer as any).serialize('test-key', async () => {
      op2Executed = true;
      return 'success';
    });

    const res = await Promise.race([
      op2Promise,
      new Promise<string>(resolve =>
        setTimeout(() => resolve('timed-out'), 500)
      ),
    ]);

    expect(res).toBe('success');
    expect(op2Executed).toBe(true);
  });
});
