/**
 * Cloudflare Pages Function: /api/test-gotenberg
 * Performs server-to-server health check and test PDF conversion against a Gotenberg endpoint.
 * Bypasses client-side CORS and Mixed-Content limitations.
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
    const rawUrl = body.url || '';
    const action = body.action || 'health';

    const baseUrl = rawUrl.trim().replace(/\/+$/, '');
    if (!baseUrl) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'URL Gotenberg tidak boleh kosong.'
      }), { status: 400, headers: corsHeaders });
    }

    // Validate URL scheme
    let parsedUrl;
    try {
      parsedUrl = new URL(baseUrl);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Protokol harus http:// atau https://');
      }
    } catch (urlErr) {
      return new Response(JSON.stringify({
        ok: false,
        error: `Format URL tidak valid: ${urlErr.message}`
      }), { status: 400, headers: corsHeaders });
    }

    // ACTION 1: HEALTH CHECK (PING)
    if (action === 'health') {
      const healthEndpoint = `${baseUrl}/health`;
      const t0 = Date.now();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

      try {
        const res = await fetch(healthEndpoint, {
          method: 'GET',
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        });
        clearTimeout(timeoutId);
        const latencyMs = Date.now() - t0;

        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          return new Response(JSON.stringify({
            ok: false,
            latencyMs,
            statusCode: res.status,
            error: `Server Gotenberg merespons HTTP ${res.status} (${res.statusText}): ${errBody.slice(0, 200)}`
          }), { status: 200, headers: corsHeaders });
        }

        const data = await res.json().catch(() => ({ status: 'unknown' }));
        return new Response(JSON.stringify({
          ok: true,
          latencyMs,
          statusCode: res.status,
          status: data.status || 'up',
          details: data.details || {},
          url: baseUrl
        }), { status: 200, headers: corsHeaders });

      } catch (fetchErr) {
        clearTimeout(timeoutId);
        const latencyMs = Date.now() - t0;
        return new Response(JSON.stringify({
          ok: false,
          latencyMs,
          error: fetchErr.name === 'AbortError' 
            ? 'Koneksi timeout (> 12 detik). Server mungkin offline atau port terblokir firewall.'
            : `Gagal menghubungi server: ${fetchErr.message}`
        }), { status: 200, headers: corsHeaders });
      }
    }

    // ACTION 2: SAMPLE CONVERSION (CHROMIUM HTML TO PDF)
    if (action === 'convert') {
      const convertEndpoint = `${baseUrl}/forms/chromium/convert/html`;
      const t0 = Date.now();

      const sampleHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Uji Gotenberg Dakwah TV</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; padding: 48px; color: #1e293b; background: #ffffff; }
    .header { border-bottom: 2px solid #0d9488; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
    .title { font-size: 20px; font-weight: 800; color: #0f766e; text-transform: uppercase; letter-spacing: 1px; margin: 0; }
    .badge { display: inline-block; padding: 4px 10px; background: #ccfbf1; color: #0f766e; border-radius: 9999px; font-size: 11px; font-weight: 700; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-top: 16px; }
    .item { margin-bottom: 10px; font-size: 13px; }
    .item strong { color: #334155; }
    .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="title">DAKWAH TV EQUIPMENT</h1>
      <p style="font-size: 12px; color: #64748b; margin: 4px 0 0 0;">Layanan Konversi Dokumen Resmi</p>
    </div>
    <div class="badge">UJI COBA BERHASIL</div>
  </div>
  <div class="card">
    <h2 style="font-size: 15px; margin-top: 0; color: #0f766e;">Status Verifikasi Engine Gotenberg</h2>
    <div class="item"><strong>Endpoint:</strong> ${baseUrl}</div>
    <div class="item"><strong>Waktu Uji:</strong> ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB</div>
    <div class="item"><strong>Engine:</strong> Chromium Headless PDF Generator</div>
    <div class="item"><strong>Status:</strong> Engine aktif dan siap digunakan untuk merender Surat Peminjaman Alat (SPA).</div>
  </div>
  <div class="footer">
    Dokumen uji ini dihasilkan secara otomatis oleh sistem Dakwah TV Equipment Library.
  </div>
</body>
</html>`;

      const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2)}`;
      const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="index.html"\r\nContent-Type: text/html; charset=utf-8\r\n\r\n`;
      const fileFooter = `\r\n--${boundary}--\r\n`;

      const encoder = new TextEncoder();
      const part1 = encoder.encode(fileHeader);
      const part2 = encoder.encode(sampleHtml);
      const part3 = encoder.encode(fileFooter);

      const totalLength = part1.byteLength + part2.byteLength + part3.byteLength;
      const multipartBody = new Uint8Array(totalLength);
      multipartBody.set(part1, 0);
      multipartBody.set(part2, part1.byteLength);
      multipartBody.set(part3, part1.byteLength + part2.byteLength);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

      try {
        const res = await fetch(convertEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`
          },
          body: multipartBody,
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        const durationMs = Date.now() - t0;

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          return new Response(JSON.stringify({
            ok: false,
            durationMs,
            statusCode: res.status,
            error: `Gotenberg gagal mengonversi (${res.status} ${res.statusText}): ${errText.slice(0, 250)}`
          }), { status: 200, headers: corsHeaders });
        }

        const pdfArrayBuffer = await res.arrayBuffer();
        const sizeBytes = pdfArrayBuffer.byteLength;

        // Convert arrayBuffer to base64
        let binary = '';
        const bytes = new Uint8Array(pdfArrayBuffer);
        const len = bytes.byteLength;
        const chunkSize = 8192;
        for (let i = 0; i < len; i += chunkSize) {
          binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunkSize, len)));
        }
        const base64Pdf = btoa(binary);

        return new Response(JSON.stringify({
          ok: true,
          durationMs,
          sizeBytes,
          contentType: 'application/pdf',
          pdfBase64: base64Pdf,
          filename: `test-gotenberg-${Date.now()}.pdf`
        }), { status: 200, headers: corsHeaders });

      } catch (convErr) {
        clearTimeout(timeoutId);
        const durationMs = Date.now() - t0;
        return new Response(JSON.stringify({
          ok: false,
          durationMs,
          error: convErr.name === 'AbortError'
            ? 'Konversi timeout (> 25 detik). Server overload atau engine Chromium tidak merespons.'
            : `Gagal konversi: ${convErr.message}`
        }), { status: 200, headers: corsHeaders });
      }
    }

    return new Response(JSON.stringify({
      ok: false,
      error: `Aksi tidak dikenal: ${action}`
    }), { status: 400, headers: corsHeaders });

  } catch (globalErr) {
    return new Response(JSON.stringify({
      ok: false,
      error: `Internal Function Error: ${globalErr.message}`
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
