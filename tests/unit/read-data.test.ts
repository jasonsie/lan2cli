import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Readable } from 'stream';
import { IncomingMessage } from 'http';
import { readData } from '../../src/helpers/completion';
import { KnownError } from '../../src/helpers/error';
import { streamToIterable } from '../../src/helpers/stream-to-iterable';

const chunk = (text: string) =>
  `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;

describe('readData', () => {
  beforeEach(() => {
    process.stdin.setRawMode = vi.fn() as any;
  });

  afterEach(() => {
    process.stdin.removeAllListeners('keypress');
  });

  it('rejects when the stream is destroyed with an error after partial text', async () => {
    const stream = new Readable({ read: () => undefined });
    stream.push(chunk('rm -rf /tmp/x'));
    setImmediate(() => stream.destroy(new KnownError('declined')));

    const read = readData(streamToIterable(stream as IncomingMessage));
    const writer = vi.fn();

    await expect(read(writer)).rejects.toThrow('declined');
  });

  it('resolves with the streamed text on a clean [DONE]', async () => {
    const stream = Readable.from([chunk('ls -la'), 'data: [DONE]\n\n']);

    const result = await readData(streamToIterable(stream as any))(vi.fn());

    expect(result).toBe('ls -la');
  });
});
