/**
 * @jest-environment node
 */

// Mock the OTel API so the handler's span emission is observable without a real
// tracer provider. startSpan returns a shared mock span whose calls we assert.
const span = {
  setAttribute: jest.fn(),
  setStatus: jest.fn(),
  recordException: jest.fn(),
  end: jest.fn(),
};
const startSpan = jest.fn(() => span);
const getTracer = jest.fn(() => ({ startSpan }));

jest.mock('@opentelemetry/api', () => ({
  trace: { getTracer },
  SpanStatusCode: { UNSET: 0, OK: 1, ERROR: 2 },
}));

import { POST } from './route';

function post(body: string | Record<string, unknown>): Request {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  return new Request('http://localhost/api/client-errors', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: payload,
  });
}

// Flatten the mock span's setAttribute calls into a plain object for assertions.
function attributes(): Record<string, unknown> {
  return Object.fromEntries(
    span.setAttribute.mock.calls.map(([key, value]) => [key, value]),
  );
}

describe('POST /api/client-errors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('records an ERROR span named client.mutation.error with operation, name, and message', async () => {
    const res = await POST(
      post({ operation: 'rescheduleWorkout', name: 'ApiClientError', message: 'Slot taken' }),
    );

    expect(res.status).toBe(204);
    expect(getTracer).toHaveBeenCalledWith('web-client-errors');
    expect(startSpan).toHaveBeenCalledWith('client.mutation.error');

    const attrs = attributes();
    expect(attrs['client.operation']).toBe('rescheduleWorkout');
    expect(attrs['client.error.name']).toBe('ApiClientError');
    expect(attrs['client.error.message']).toBe('Slot taken');

    expect(span.setStatus).toHaveBeenCalledWith(expect.objectContaining({ code: 2 }));
    expect(span.recordException).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'ApiClientError', message: 'Slot taken' }),
    );
    expect(span.end).toHaveBeenCalledTimes(1);
  });

  it('promotes only scalar context values to client.context.* attributes', async () => {
    await POST(
      post({
        operation: 'upsertLiftOverride',
        message: 'boom',
        context: {
          program: '5-3-1',
          cycleNum: 3,
          enabled: true,
          nested: { a: 1 }, // dropped — never serialize nested objects
          list: [1, 2], // dropped
          missing: null, // dropped
        },
      }),
    );

    const attrs = attributes();
    expect(attrs['client.context.program']).toBe('5-3-1');
    expect(attrs['client.context.cycleNum']).toBe(3);
    expect(attrs['client.context.enabled']).toBe(true);
    expect(attrs).not.toHaveProperty('client.context.nested');
    expect(attrs).not.toHaveProperty('client.context.list');
    expect(attrs).not.toHaveProperty('client.context.missing');
  });

  it('omits client.error.name when the report has no name (non-Error origin)', async () => {
    await POST(post({ operation: 'undoImport', message: 'a string failure' }));

    const attrs = attributes();
    expect(attrs['client.error.message']).toBe('a string failure');
    expect(attrs).not.toHaveProperty('client.error.name');
  });

  it('defaults operation to "unknown" when the report omits it', async () => {
    await POST(post({ message: 'orphan error' }));
    expect(attributes()['client.operation']).toBe('unknown');
  });

  it('drops a malformed JSON body without emitting a span and never 500s', async () => {
    const res = await POST(post('not valid json{'));

    expect(res.status).toBe(204);
    expect(startSpan).not.toHaveBeenCalled();
  });

  it('drops a non-object JSON body (array) without a span', async () => {
    const res = await POST(post('[1,2,3]'));

    expect(res.status).toBe(204);
    expect(startSpan).not.toHaveBeenCalled();
  });

  it('drops an empty body without a span', async () => {
    const res = await POST(post(''));

    expect(res.status).toBe(204);
    expect(startSpan).not.toHaveBeenCalled();
  });

  it('drops an oversized body (> 4KB) without a span', async () => {
    const res = await POST(post({ operation: 'createLiftRecord', message: 'x'.repeat(5000) }));

    expect(res.status).toBe(204);
    expect(startSpan).not.toHaveBeenCalled();
  });

  it('clamps an over-long string field rather than emitting it wholesale', async () => {
    // 600-char message: under the 4KB body cap, over the 512-char attribute cap.
    await POST(post({ operation: 'skipWorkout', message: 'y'.repeat(600) }));

    const message = attributes()['client.error.message'] as string;
    expect(message).toHaveLength(512);
  });

  it('never 500s when a span operation throws — the outer catch holds and span.end still runs', async () => {
    // The headline guarantee: a telemetry sink must never surface a 500. Force a
    // span op to throw and assert the response is still 204 and end() ran (finally).
    span.setAttribute.mockImplementationOnce(() => {
      throw new Error('otel exploded');
    });

    const res = await POST(post({ operation: 'skipWorkout', message: 'boom' }));

    expect(res.status).toBe(204);
    expect(span.end).toHaveBeenCalledTimes(1);
  });
});
