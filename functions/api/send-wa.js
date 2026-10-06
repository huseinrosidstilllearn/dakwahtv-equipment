export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { target, message, countryCode = '62' } = body;
    // Restrict origin to legitimate Dakwah TV domains
    const origin = context.request.headers.get('Origin') || '';
    const isAllowedOrigin = 
      !origin || 
      origin.includes('dakwahtvequipment.pages.dev') || 
      origin.includes('dakwahtv.my.id') || 
      origin.includes('localhost') || 
      origin.includes('127.0.0.1');

    if (!isAllowedOrigin) {
      return new Response(JSON.stringify({ status: false, message: 'Akses ditolak (Origin tidak diizinkan)' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const cleanTarget = String(target).trim();
    const isValidTarget = /^[0-9+]{8,18}$/.test(cleanTarget) || cleanTarget.endsWith('@g.us');
    if (!isValidTarget) {
      return new Response(JSON.stringify({ status: false, message: 'Format nomor target WhatsApp tidak valid' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (String(message).length > 2500) {
      return new Response(JSON.stringify({ status: false, message: 'Pesan melebihi batas panjang maksimum' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Secret Token read from Cloudflare Pages Environment Variables
    const token = context.env.FONNTE_TOKEN;
    if (!token) {
      return new Response(JSON.stringify({
        status: false,
        message: 'FONNTE_TOKEN belum dikonfigurasi di Cloudflare Variables and Secrets.'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': token,
      },
      body: new URLSearchParams({
        target: String(target),
        message: String(message),
        countryCode: String(countryCode),
      }),
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
