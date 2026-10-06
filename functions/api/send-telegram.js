/**
 * Cloudflare Pages Function: /api/send-telegram
 * Sends alerts and notifications to Telegram groups/channels via Telegram Bot API.
 * Keeps Bot Token secure on the serverless edge layer.
 */

export async function onRequestPost(context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    const body = await context.request.json().catch(() => ({}));
    const { text, chatId, botToken, parseMode = 'Markdown' } = body;

    // Restrict origin to legitimate Dakwah TV domains
    const origin = context.request.headers.get('Origin') || '';
    const isAllowedOrigin = 
      !origin || 
      origin.includes('dakwahtvequipment.pages.dev') || 
      origin.includes('dakwahtv.my.id') || 
      origin.includes('localhost') || 
      origin.includes('127.0.0.1');

    if (!isAllowedOrigin) {
      return new Response(JSON.stringify({ ok: false, error: 'Akses ditolak (Origin tidak diizinkan).' }), {
        status: 403,
        headers: corsHeaders
      });
    }

    if (!text || !text.trim()) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'Isi pesan teks tidak boleh kosong.'
      }), { status: 400, headers: corsHeaders });
    }

    if (String(text).length > 3000) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'Pesan melebihi batas panjang maksimum.'
      }), { status: 400, headers: corsHeaders });
    }

    // Token priority: request body -> environment variable
    const token = (botToken || context.env.TELEGRAM_BOT_TOKEN || '').trim();
    const targetChatId = (chatId || context.env.TELEGRAM_CHAT_ID || '').trim();

    if (!token) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'Telegram Bot Token belum dikonfigurasi. Masukkan token dari @BotFather.'
      }), { status: 400, headers: corsHeaders });
    }

    if (!targetChatId) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'Telegram Chat ID target belum ditentukan.'
      }), { status: 400, headers: corsHeaders });
    }

    const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const tgRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChatId,
        text: text,
        parse_mode: parseMode,
        disable_web_page_preview: false
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const tgData = await tgRes.json().catch(() => ({}));

    if (!tgRes.ok || !tgData.ok) {
      const errMsg = tgData.description || `HTTP ${tgRes.status}: ${tgRes.statusText}`;
      return new Response(JSON.stringify({
        ok: false,
        error: `Telegram API Error: ${errMsg}`,
        statusCode: tgRes.status
      }), { status: 200, headers: corsHeaders });
    }

    return new Response(JSON.stringify({
      ok: true,
      messageId: tgData.result?.message_id,
      chat: {
        id: tgData.result?.chat?.id,
        title: tgData.result?.chat?.title || tgData.result?.chat?.first_name || 'Direct Message'
      }
    }), { status: 200, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({
      ok: false,
      error: err.name === 'AbortError' 
        ? 'Koneksi ke Telegram API timeout (> 10 detik).' 
        : `Gagal mengirim ke Telegram: ${err.message}`
    }), { status: 500, headers: corsHeaders });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}
