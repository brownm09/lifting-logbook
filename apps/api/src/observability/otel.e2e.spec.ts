// Set before any other imports so the production otel.ts (loaded via main.ts
// in real bootstraps) does not start its own SDK.
process.env.OTEL_SDK_AUTOSTART = 'false';
process.env.OTEL_SDK_DISABLED = 'true';

import { PrismaInstrumentation } from '@prisma/instrumentation';

import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { trace, context } from '@opentelemetry/api';

const exporter = new InMemorySpanExporter();
const tracerProvider = new NodeTracerProvider({
  spanProcessors: [new SimpleSpanProcessor(exporter)],
});
tracerProvider.register();

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';

import { AppModule } from '../app.module';

describe('OTel + nestjs-pino trace correlation (smoke)', () => {
  let app: NestFastifyApplication;
  let logLines: string[];
  let origStdoutWrite: typeof process.stdout.write;

  beforeAll(async () => {
    logLines = [];
    origStdoutWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: unknown, ...rest: unknown[]) => {
      try {
        logLines.push(String(chunk));
      } catch {
        /* ignore */
      }
      return (origStdoutWrite as (...args: unknown[]) => boolean)(chunk, ...rest);
    }) as typeof process.stdout.write;

    app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter(),
      { bufferLogs: true },
    );
    app.useLogger(app.get(Logger));
    await app.init();
  });

  afterAll(async () => {
    process.stdout.write = origStdoutWrite;
    await app?.close();
    await tracerProvider?.shutdown();
  });

  it('emits at least one span and a log line carrying the same trace_id', async () => {
    const tracer = trace.getTracer('otel-smoke-test');

    const traceId: string = await tracer.startActiveSpan(
      'inbound-request',
      async (span) => {
        const id = span.spanContext().traceId;
        const requestLogger = app.get(Logger);
        // Emit an explicit log line within the active span; the mixin in
        // app.module.ts injects trace_id and span_id from OTel context. We do
        // not exercise the real HTTP path here because http auto-instrumentation
        // patches via require-in-the-middle, and Jest has already loaded http
        // before this test's tracer setup runs — see journal 2026-05-08 for the
        // analysis. Manual smoke (start:dev + curl) covers HTTP-instrumented
        // spans end-to-end.
        await context.with(trace.setSpan(context.active(), span), async () => {
          requestLogger.log('handling /health');
        });
        span.end();
        return id;
      },
    );

    await new Promise((r) => setTimeout(r, 50));

    const spans = exporter.getFinishedSpans();
    expect(spans.length).toBeGreaterThan(0);
    expect(spans.some((s) => s.spanContext().traceId === traceId)).toBe(true);

    const logRecords = logLines
      .flatMap((line) => line.split('\n'))
      .map((line) => line.trim())
      .filter((line) => line.startsWith('{'))
      .map((line) => {
        try {
          return JSON.parse(line) as Record<string, unknown>;
        } catch {
          return null;
        }
      })
      .filter((r): r is Record<string, unknown> => r !== null);

    const matched = logRecords.find(
      (r) => typeof r.trace_id === 'string' && r.trace_id === traceId,
    );
    expect(matched).toBeDefined();
  });
});

describe('PrismaInstrumentation (#348 regression)', () => {
  it('is importable and instantiates without crashing', () => {
    // Verifies that @prisma/instrumentation is on the resolution path and that
    // PrismaInstrumentation can be constructed. This test would fail if the package
    // were removed from apps/api dependencies, and provides an import-level signal
    // for the fix introduced in #348. The v1/v2 tracer API crash (getActiveSpanProcessor
    // at $connect()) requires a real DATABASE_URL and is verified in staging.
    expect(() => new PrismaInstrumentation()).not.toThrow();
  });
});
