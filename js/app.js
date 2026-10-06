// Shared Supabase client + login helpers for every page.
const sb = window.supabase.createClient(
  window.SD_CONFIG.SUPABASE_URL,
  window.SD_CONFIG.SUPABASE_KEY,
  { db: { schema: 'erp' } }
);

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function showMsg(text, isError = false) {
  const el = $('#msg');
  if (!el) return;
  el.textContent = text;
  el.className = isError ? 'msg error' : 'msg ok';
}

async function requireLogin() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { location.href = 'index.html'; return null; }
  return session;
}

async function myAccess() {
  const { data, error } = await sb.rpc('my_access');
  if (error) throw error;
  return data;
}

async function logout() {
  await sb.auth.signOut();
  location.href = 'index.html';
}
