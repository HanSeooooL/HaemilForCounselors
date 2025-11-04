// Simple API smoke test for RN backend
// Usage:
//   API_BASE=http://127.0.0.1:5000 node scripts/api-smoke.mjs
// Defaults to 127.0.0.1:5000 if API_BASE is not provided.

// Polyfill fetch on Node < 18
if (typeof fetch === 'undefined') {
  const { default: fetchFn } = await import('node-fetch');
  globalThis.fetch = fetchFn;
}

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:5000';

function log(title, obj) {
  const time = new Date().toISOString();
  console.log(`\n[${time}] ${title}`);
  if (obj !== undefined) console.log(obj);
}

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 10000); // 10s timeout
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      signal: ctrl.signal,
      ...options,
    });
    const text = await res.text().catch(() => '');
    let json;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = undefined;
    }
    return { res, text, json };
  } catch (e) {
    throw new Error(`[request failed] ${url} -> ${e?.name || ''} ${e?.message || e}`);
  } finally {
    clearTimeout(to);
  }
}

(async function main() {
  log('API_BASE', API_BASE);
  const rnd = Math.random().toString(36).slice(2, 8);
  const user = {
    id: `user_${Date.now()}_${rnd}`,
    email: `u_${rnd}@example.com`,
    password: 'pw123456',
  };

  try {
    // 1) Signup
    log('Signup: POST /auth/signup', { ...user, password: '***' });
    const s1 = await request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(user),
    });
    log('Signup response', { status: s1.res.status, statusText: s1.res.statusText, body: s1.json || s1.text });
    if (!s1.res.ok) throw new Error(`Signup failed: HTTP ${s1.res.status}`);
    const signupToken = s1.json?.jwt || s1.json?.token;
    if (!signupToken) throw new Error('Signup failed: token/jwt missing in response');

    // 2) Login success
    log('Login: POST /auth/login', { id: user.id, password: '***' });
    const l1 = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ id: user.id, password: user.password }),
    });
    log('Login response', { status: l1.res.status, statusText: l1.res.statusText, body: l1.json || l1.text });
    if (!l1.res.ok) throw new Error(`Login failed: HTTP ${l1.res.status}`);
    const loginToken = l1.json?.jwt || l1.json?.token;
    if (!loginToken) throw new Error('Login failed: token/jwt missing in response');

    // 3) Duplicate signup (should be 409 or 4xx)
    log('Duplicate signup: POST /auth/signup', { ...user, password: '***' });
    const s2 = await request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(user),
    });
    log('Duplicate signup response', { status: s2.res.status, statusText: s2.res.statusText, body: s2.json || s2.text });

    // 4) Wrong password login (should be 401)
    log('Wrong password login: POST /auth/login', { id: user.id, password: '***wrong***' });
    const l2 = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ id: user.id, password: user.password + 'x' }),
    });
    log('Wrong password response', { status: l2.res.status, statusText: l2.res.statusText, body: l2.json || l2.text });

    console.log('\nSMOKE RESULT: done');
    process.exit(0);
  } catch (e) {
    console.error('\nSMOKE RESULT: failed');
    console.error(e?.stack || e?.message || e);
    console.error('\nHints:');
    console.error('- 서버가 실행 중인지 확인하세요. (Flask: http://127.0.0.1:5000)');
    console.error('- 라우트: POST /auth/signup, POST /auth/login 이 존재하는지');
    console.error('- CORS/CSRF 정책으로 403이 발생하지 않는지');
    console.error('- 다른 포트/호스트 사용 시 API_BASE 환경변수를 지정하세요.');
    process.exit(1);
  }
})();
