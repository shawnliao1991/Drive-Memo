// Adapts the native Google SDK to the existing sync module's auth contract.
export function createAuth({ plugin, config, platform, fetchImpl = fetch, now = Date.now }, callbacks = {}) {
  const { onIdentity = () => {}, onConnected = () => {}, onStatus = () => {}, onReady = () => {} } = callbacks;
  let ready, token = null, expires = 0, pending = null, generation = 0, signedOut = false;
  const options = { provider: 'google', options: { scopes: ['openid', 'email', 'https://www.googleapis.com/auth/drive'] } };
  function setup() {
    if (platform === 'ios' && !config.iOSClientId) throw Error('尚未設定 iPhone 的 Google OAuth Client ID，請完成 App 登入設定。');
    if (!ready) ready = plugin.initialize({ google: { webClientId: config.GOOGLE_CLIENT_ID, iOSClientId: config.iOSClientId, mode: 'online' } }).catch(error => { ready = null; throw error; });
    return ready;
  }
  async function accept(response, epoch) {
    const access = response.result?.accessToken?.token;
    if (!access) throw Error('未取得 Google Drive 授權，請重新登入並允許存取 Drive。');
    const result = await fetchImpl('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${access}` } });
    if (!result.ok) throw Error('Google 帳號驗證失敗，請重新登入。');
    const me = await result.json();
    if (epoch !== generation || signedOut) throw Error('AUTH_EXPIRED');
    if (config.ALLOWED_EMAIL && me.email?.toLowerCase() !== config.ALLOWED_EMAIL.toLowerCase()) throw Error('此 Google 帳號不在允許名單內。');
    token = access;
    // The SDK owns credential persistence; the web layer keeps only a short-lived access token.
    const sdkExpiry = Date.parse(response.result.accessToken.expires);
    expires = Number.isFinite(sdkExpiry) ? sdkExpiry : now() + 45 * 60 * 1000;
    onIdentity(me.email); onConnected(true);
    return token;
  }
  function request(interactive) {
    if (pending) return pending;
    const epoch = generation;
    const task = (async () => {
      await setup();
      if (!interactive) {
        const session = await plugin.isLoggedIn({ provider: 'google' });
        if (!session.isLoggedIn) throw Error('AUTH_EXPIRED');
        const credentials = await plugin.getAuthorizationCode({ provider: 'google' });
        if (!credentials.accessToken) throw Error('AUTH_EXPIRED');
        return accept({ result: { accessToken: { token: credentials.accessToken } } }, epoch);
      }
      return accept(await plugin.login(options), epoch);
    })();
    pending = task;
    task.finally(() => { if (pending === task) pending = null; }).catch(() => {});
    return task;
  }
  async function getToken(force = false) {
    if (signedOut) throw Error('AUTH_EXPIRED');
    if (!force && token && expires > now() + 60000) return token;
    try { return await request(false); }
    catch (error) { token = null; onConnected(false); throw error; }
  }
  async function initialize() {
    try { await getToken(); return true; }
    catch (error) { onStatus(error.message === 'AUTH_EXPIRED' ? '請連接 Google；本機筆記可繼續編輯。' : error.message, ''); return false; }
  }
  async function login() {
    signedOut = false;
    try { await request(true); await onReady(); }
    catch (error) { onStatus(error.message === 'AUTH_EXPIRED' ? '請重新連接 Google。' : error.message, 'err'); }
  }
  async function logout() {
    signedOut = true; generation++; token = null; expires = 0;
    const old = pending;
    onConnected(false); onIdentity('');
    // Wait for any in-flight SDK login so it cannot recreate a session after logout.
    if (old) await old.catch(() => {});
    await setup(); await plugin.logout({ provider: 'google' });
  }
  return { getToken, initialize, login, logout };
}
