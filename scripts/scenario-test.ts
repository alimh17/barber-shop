const baseUrl = process.env.LOAD_BASE_URL ?? 'http://127.0.0.1:3000';

async function request(path: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}${path}`, init);
}

async function login(phone: string, salonSlug: string) {
  const otpResponse = await request('/api/auth/request-otp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone, salonSlug }),
  });
  if (!otpResponse.ok)
    throw new Error(`OTP request failed: ${otpResponse.status}`);
  const { otp } = (await otpResponse.json()) as { otp?: string };
  if (!otp) throw new Error('Scenario test requires development mock OTP');
  const authResponse = await request('/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone, code: otp, salonSlug }),
  });
  if (!authResponse.ok)
    throw new Error(`OTP verification failed: ${authResponse.status}`);
  return ((await authResponse.json()) as { accessToken: string }).accessToken;
}

async function expectStatus(
  name: string,
  response: Promise<Response>,
  allowed: number[],
) {
  const result = await response;
  if (!allowed.includes(result.status)) {
    throw new Error(
      `${name}: expected ${allowed.join('/')}, received ${result.status}: ${await result.text()}`,
    );
  }
  console.log(`PASS ${name} (${result.status})`);
}

const auth = (token: string) => ({
  headers: { authorization: `Bearer ${token}` },
});

async function main() {
  const [admin, barber, customer] = await Promise.all([
    login('09800000000', 'loadtest-01'),
    login('09800000020', 'loadtest-01'),
    login('09800000120', 'loadtest-01'),
  ]);

  await expectStatus(
    'admin reads own salons',
    request('/api/salons', auth(admin)),
    [200],
  );
  await expectStatus(
    'admin cannot read another tenant salon',
    request('/api/salons/load-salon-0001', auth(admin)),
    [403, 404],
  );
  await expectStatus(
    'admin cannot read another tenant SMS settings',
    request('/api/salons/load-salon-0001/sms-config', auth(admin)),
    [403, 404],
  );
  await expectStatus(
    'barber can read assigned appointments',
    request('/api/appointments', auth(barber)),
    [200],
  );
  await expectStatus(
    'customer can read own appointments',
    request('/api/appointments/mine', auth(customer)),
    [200],
  );
  await expectStatus(
    'customer cannot list users',
    request('/api/users?limit=20', auth(customer)),
    [403],
  );

  const scopedOtp = await request('/api/auth/request-otp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone: '09800000121', salonSlug: 'loadtest-02' }),
  });
  const { otp } = (await scopedOtp.json()) as { otp?: string };
  if (!otp) throw new Error('Expected mock OTP for tenant-scope scenario');
  await expectStatus(
    'OTP from tenant 2 is rejected in tenant 1',
    request('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        phone: '09800000121',
        code: otp,
        salonSlug: 'loadtest-01',
      }),
    }),
    [400],
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
