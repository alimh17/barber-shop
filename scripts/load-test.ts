import { performance } from 'node:perf_hooks';

const baseUrl = process.env.LOAD_BASE_URL ?? 'http://127.0.0.1:3000';
const concurrency = Number.parseInt(process.env.LOAD_CONCURRENCY ?? '50', 10);
const iterations = Number.parseInt(process.env.LOAD_ITERATIONS ?? '1000', 10);
const maxErrorRate = Number.parseFloat(
  process.env.LOAD_MAX_ERROR_RATE ?? '0.01',
);
const maxP95Ms = Number.parseInt(process.env.LOAD_MAX_P95_MS ?? '500', 10);

if (![concurrency, iterations, maxP95Ms].every(Number.isFinite)) {
  throw new Error('Invalid load-test numeric configuration');
}

type Session = { role: 'ADMIN' | 'BARBER' | 'CUSTOMER'; token: string };
type Sample = { duration: number; ok: boolean; status: number; path: string };

async function login(
  phone: string,
  salonSlug: string,
  role: Session['role'],
): Promise<Session> {
  const request = await fetch(`${baseUrl}/api/auth/request-otp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone, salonSlug }),
  });
  if (!request.ok)
    throw new Error(
      `${role} OTP request failed: ${request.status} ${await request.text()}`,
    );
  const otpResponse = (await request.json()) as { otp?: string };
  if (!otpResponse.otp)
    throw new Error(
      'Load test requires NODE_ENV=development and SMS_PROVIDER=mock',
    );
  const verify = await fetch(`${baseUrl}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone, code: otpResponse.otp, salonSlug }),
  });
  if (!verify.ok)
    throw new Error(
      `${role} OTP verification failed: ${verify.status} ${await verify.text()}`,
    );
  const auth = (await verify.json()) as { accessToken: string };
  return { role, token: auth.accessToken };
}

async function sample(path: string, token: string): Promise<Sample> {
  const started = performance.now();
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    await response.arrayBuffer();
    return {
      duration: performance.now() - started,
      ok: response.ok,
      status: response.status,
      path,
    };
  } catch {
    return {
      duration: performance.now() - started,
      ok: false,
      status: 0,
      path,
    };
  }
}

function percentile(values: number[], ratio: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return (
    sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)] ??
    0
  );
}

async function main() {
  console.log(`Preparing role sessions against ${baseUrl}...`);
  const sessions = await Promise.all([
    login('09800000000', 'loadtest-01', 'ADMIN'),
    login('09800000020', 'loadtest-01', 'BARBER'),
    login('09800000120', 'loadtest-01', 'CUSTOMER'),
  ]);
  const paths: Record<Session['role'], string[]> = {
    ADMIN: ['/api/salons', '/api/users?limit=20', '/api/appointments'],
    BARBER: ['/api/salons', '/api/appointments'],
    CUSTOMER: ['/api/salons', '/api/appointments/mine'],
  };
  const samples: Sample[] = [];
  let cursor = 0;
  const started = performance.now();
  await Promise.all(
    Array.from({ length: concurrency }, async (_, workerIndex) => {
      const session = sessions[workerIndex % sessions.length];
      while (true) {
        const index = cursor++;
        if (index >= iterations) return;
        const rolePaths = paths[session.role];
        samples.push(
          await sample(rolePaths[index % rolePaths.length], session.token),
        );
      }
    }),
  );

  const elapsedMs = performance.now() - started;
  const failed = samples.filter((entry) => !entry.ok);
  const durations = samples.map((entry) => entry.duration);
  const summary = {
    iterations: samples.length,
    concurrency,
    elapsedSeconds: Number((elapsedMs / 1000).toFixed(2)),
    requestsPerSecond: Number((samples.length / (elapsedMs / 1000)).toFixed(2)),
    errorRate: Number((failed.length / samples.length).toFixed(4)),
    p50Ms: Number(percentile(durations, 0.5).toFixed(2)),
    p95Ms: Number(percentile(durations, 0.95).toFixed(2)),
    p99Ms: Number(percentile(durations, 0.99).toFixed(2)),
    failuresByStatus: Object.fromEntries(
      [...new Set(failed.map((entry) => entry.status))].map((status) => [
        status,
        failed.filter((entry) => entry.status === status).length,
      ]),
    ),
  };
  console.log(JSON.stringify(summary, null, 2));
  if (summary.errorRate > maxErrorRate || summary.p95Ms > maxP95Ms) {
    throw new Error(
      `Load thresholds failed: errorRate<=${maxErrorRate}, p95<=${maxP95Ms}ms`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
