import test from 'node:test';
import assert from 'node:assert/strict';
import { geminiAi } from '../src/ai.ts';

const response = (value: unknown, finishReason = 'STOP') =>
  new Response(
    JSON.stringify({
      candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify(value) }] } }],
    }),
  );
test('AI sends the question as source data and validates the returned answer', async () => {
  const provider = geminiAi('test-secret', 'test-model', async (_url, options) => {
    const body = JSON.parse(options?.body as string);
    assert.match(body.systemInstruction.parts[0].text, /untrusted data/);
    assert.deepEqual(JSON.parse(body.contents[0].parts[0].text), {
      source: { question: 'Explain the tree' },
    });
    assert.equal((options?.headers as Record<string, string>)['x-goog-api-key'], 'test-secret');
    return response({ answer: ' From the lecture. ' });
  });
  assert.deepEqual(await provider.generate('ask', { question: 'Explain the tree' }, []), {
    answer: 'From the lecture.',
  });
});
test('missing configuration and excessive context make no provider requests', async () => {
  let calls = 0;
  const transport: typeof fetch = async () => {
    calls++;
    return response({});
  };
  await assert.rejects(geminiAi(undefined, 'model', transport).generate('extract', {}, []), {
    statusCode: 503,
  });
  const photos = Array.from({ length: 7 }, () => ({
    bytes: new Uint8Array([1]),
    mimeType: 'image/png',
  }));
  await assert.rejects(geminiAi('key', 'model', transport).generate('extract', {}, photos), {
    code: 'CONTEXT_TOO_LARGE',
  });
  assert.equal(calls, 0);
});
test('truncated and malformed AI results cannot become saved study content', async () => {
  await assert.rejects(
    geminiAi('key', 'model', async () => response({ answer: 'Partial' }, 'MAX_TOKENS')).generate(
      'ask',
      {},
      [],
    ),
    { code: 'AI_INCOMPLETE' },
  );
  await assert.rejects(
    geminiAi('key', 'model', async () => response({ answer: '' })).generate('ask', {}, []),
    { code: 'AI_INVALID_RESULT' },
  );
  await assert.rejects(
    geminiAi('key', 'model', async () =>
      response({ error: 'Insufficient source material' }),
    ).generate('quiz', {}, []),
    { code: 'AI_INVALID_RESULT' },
  );
});
test('provider quota and network failures remain retryable without leaking provider details', async () => {
  for (const transport of [
    async () => new Response('secret-provider-message', { status: 429 }),
    async () => {
      throw new Error('private-network-detail');
    },
  ]) {
    await assert.rejects(geminiAi('key', 'model', transport).generate('ask', {}, []), (error) => {
      assert.equal((error as { statusCode: number }).statusCode, 503);
      assert.doesNotMatch((error as Error).message, /secret-provider|private-network/);
      return true;
    });
  }
});
