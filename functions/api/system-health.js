/**
 * Cloudflare Pages Function: /api/system-health
 * Performs parallel health checks and latency benchmarks across all core services:
 * 1. Supabase Database & REST API
 * 2. Gotenberg PDF Engine
 * 3. Cloudflare R2 Worker Uploader
 * 4. Fonnte WhatsApp Gateway
 * 5. Telegram Bot API
 */

export async function onRequest(context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Parse custom parameters if POST was sent
  let body = {};
  if (context.request.method === 'POST') {
    body = await context.request.json().catch(() => ({}));
  }

  const customGotenberg = (body.gotenbergUrl || '').trim();
  const customTgToken = (body.telegramBotToken || context.env.TELEGRAM_BOT_TOKEN || '').trim();
  const fonnteToken = (body.fonnteToken || context.env.FONNTE_TOKEN || '6zWjLzHFtYJavkm7y3qT').trim();

  const timeoutFetch = async (url, options = {}, timeoutMs = 6000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const t0 = Date.now();
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      const latency = Date.now() - t0;
      return { ok: res.ok, status: res.status, statusText: res.statusText, latency, res };
    } catch (err) {
      clearTimeout(id);
      const latency = Date.now() - t0;
      return { 
        ok: false, 
        status: 0, 
        statusText: err.name === 'AbortError' ? 'Timeout' : err.message, 
        latency, 
        error: err.message 
      };
    }
  };

  // Run all service checks in parallel
  const [supabaseResult, gotenbergResult, r2Result, waResult, telegramResult] = await Promise.allSettled([
    // 1. SUPABASE REST API
    (async () => {
      const url = 'https://fkdbgmcphqvejborcesc.supabase.co/rest/v1/config?select=key&limit=1';
      const anonKey = context.env.SUPABASE_ANON_KEY || 'sb_publishable_XMeUalHSU1OKdf9raG6-Rw_uCzDhbCF';
      const check = await timeoutFetch(url, {
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`
        }
      });
      return {
        id: 'supabase',
        name: 'Supabase PostgreSQL DB & Auth',
        endpoint: 'fkdbgmcphqvejborcesc.supabase.co',
        status: check.ok ? 'up' : 'down',
        latencyMs: check.latency,
        statusCode: check.status,
        message: check.ok ? 'Database & Auth REST API Sehat' : `Gagal: ${check.statusText}`
      };
    })(),

    // 2. GOTENBERG PDF CONVERTER
    (async () => {
      const base = customGotenberg || 'https://gotenberg.dakwahtv.my.id';
      const clean = base.replace(/\/+$/, '');
      const check = await timeoutFetch(`${clean}/health`);
      let details = {};
      if (check.ok && check.res) {
        try {
          const json = await check.res.json();
          details = json.details || {};
        } catch { /* ignore json parse error */ }
      }
      return {
        id: 'gotenberg',
        name: 'Gotenberg Headless PDF Engine',
        endpoint: clean,
        status: check.ok ? 'up' : 'down',
        latencyMs: check.latency,
        statusCode: check.status,
        details: {
          libreoffice: details.libreoffice?.status || (check.ok ? 'up' : 'down'),
          chromium: details.chromium?.status || (check.ok ? 'up' : 'down')
        },
        message: check.ok 
          ? `Engine PDF Aktif (LibreOffice & Chromium UP)` 
          : `Gagal terhubung (${check.statusText})`
      };
    })(),

    // 3. CLOUDFLARE R2 STORAGE WORKER
    (async () => {
      const endpoint = 'https://equipment-photo-uploader.dakwahtvteknis.workers.dev';
      const check = await timeoutFetch(endpoint, { method: 'GET' });
      // Worker returns 404 or 400 when called without subpath, which still proves the worker is live and reachable!
      const isLive = check.status > 0 && check.status < 500;
      return {
        id: 'r2_storage',
        name: 'Cloudflare R2 Storage Worker',
        endpoint: 'equipment-photo-uploader...workers.dev',
        status: isLive ? 'up' : 'down',
        latencyMs: check.latency,
        statusCode: check.status,
        message: isLive ? 'Object Storage Gateway Aktif' : `Gagal: ${check.statusText}`
      };
    })(),

    // 4. FONNTE WHATSAPP GATEWAY
    (async () => {
      const endpoint = 'https://api.fonnte.com/get-devices';
      const check = await timeoutFetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': fonnteToken }
      });
      let deviceStatus = 'online';
      if (check.ok && check.res) {
        try {
          const data = await check.res.json();
          if (data.data && Array.isArray(data.data) && data.data.length > 0) {
            deviceStatus = data.data[0].status || 'connected';
          }
        } catch { /* ignore */ }
      }
      const isUp = check.ok || (check.status > 0 && check.status < 500);
      return {
        id: 'whatsapp_fonnte',
        name: 'Fonnte WhatsApp API Gateway',
        endpoint: 'api.fonnte.com',
        status: isUp ? 'up' : 'down',
        latencyMs: check.latency,
        statusCode: check.status,
        details: { deviceStatus },
        message: isUp ? `Gateway WhatsApp Aktif (Device: ${deviceStatus})` : `Gagal: ${check.statusText}`
      };
    })(),

    // 5. TELEGRAM BOT API
    (async () => {
      if (!customTgToken) {
        return {
          id: 'telegram_bot',
          name: 'Telegram Bot Dispatcher',
          endpoint: 'api.telegram.org',
          status: 'unconfigured',
          latencyMs: 0,
          message: 'Token Bot belum disetel di pengaturan Admin.'
        };
      }

      const endpoint = `https://api.telegram.org/bot${customTgToken}/getMe`;
      const check = await timeoutFetch(endpoint);
      let botInfo = {};
      if (check.ok && check.res) {
        try {
          const json = await check.res.json();
          if (json.ok && json.result) {
            botInfo = {
              username: json.result.username,
              firstName: json.result.first_name,
              canJoinGroups: json.result.can_join_groups
            };
          }
        } catch { /* ignore */ }
      }

      return {
        id: 'telegram_bot',
        name: 'Telegram Bot Dispatcher',
        endpoint: 'api.telegram.org',
        status: check.ok ? 'up' : 'down',
        latencyMs: check.latency,
        statusCode: check.status,
        details: botInfo,
        message: check.ok 
          ? `Bot @${botInfo.username || 'active'} Terhubung & Siap Kirim Pesan` 
          : `Gagal verifikasi token bot (${check.statusText})`
      };
    })()
  ]);

  const services = [
    supabaseResult.status === 'fulfilled' ? supabaseResult.value : { id: 'supabase', name: 'Supabase', status: 'down', message: 'Check failed' },
    gotenbergResult.status === 'fulfilled' ? gotenbergResult.value : { id: 'gotenberg', name: 'Gotenberg', status: 'down', message: 'Check failed' },
    r2Result.status === 'fulfilled' ? r2Result.value : { id: 'r2_storage', name: 'Cloudflare R2', status: 'down', message: 'Check failed' },
    waResult.status === 'fulfilled' ? waResult.value : { id: 'whatsapp_fonnte', name: 'Fonnte WA', status: 'down', message: 'Check failed' },
    telegramResult.status === 'fulfilled' ? telegramResult.value : { id: 'telegram_bot', name: 'Telegram Bot', status: 'unconfigured', message: 'Check failed' },
  ];

  // Compute overall status
  const criticalServices = services.filter(s => s.id !== 'telegram_bot');
  const allCriticalUp = criticalServices.every(s => s.status === 'up');
  const anyCriticalDown = criticalServices.some(s => s.status === 'down');

  let overallStatus = 'healthy';
  if (anyCriticalDown) {
    overallStatus = criticalServices.filter(s => s.status === 'up').length === 0 ? 'down' : 'degraded';
  }

  return new Response(JSON.stringify({
    ok: true,
    overallStatus,
    timestamp: new Date().toISOString(),
    services
  }), { status: 200, headers: corsHeaders });
}
