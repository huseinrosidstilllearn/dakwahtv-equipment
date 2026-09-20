/**
 * Utility for Testing Gotenberg Server Health and PDF Conversion
 * Supports both Cloudflare Serverless Function proxy and direct client-side fallback.
 */

export const DEFAULT_GOTENBERG_URL = 'https://gotenberg.dakwahtv.my.id';

/**
 * Test Gotenberg Connectivity & Health (Ping)
 * @param {string} targetUrl Gotenberg endpoint URL
 * @returns {Promise<{success: boolean, latency: number, status?: string, details?: any, message: string}>}
 */
export async function testGotenbergHealth(targetUrl) {
  const cleanUrl = (targetUrl || DEFAULT_GOTENBERG_URL).trim().replace(/\/+$/, '');
  if (!cleanUrl) {
    return {
      success: false,
      latency: 0,
      message: 'Harap masukkan URL Gotenberg yang valid.'
    };
  }

  // 1. Try via Edge Function proxy
  try {
    const t0 = performance.now();
    const proxyRes = await fetch('/api/test-gotenberg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: cleanUrl, action: 'health' })
    });

    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data.ok) {
        return {
          success: true,
          latency: data.latencyMs || Math.round(performance.now() - t0),
          status: data.status,
          details: data.details,
          message: `Server Sehat (UP). Latensi: ${data.latencyMs}ms. Chromium: ${data.details?.chromium?.status || 'up'}, LibreOffice: ${data.details?.libreoffice?.status || 'up'}.`
        };
      } else {
        return {
          success: false,
          latency: data.latencyMs || Math.round(performance.now() - t0),
          message: data.error || 'Server Gotenberg merespons dengan kesalahan.'
        };
      }
    }
  } catch {
    // Edge function unavailable (e.g. running in local Vite dev), proceed to direct client fallback
  }

  // 2. Direct client-side fallback
  try {
    const t0 = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`${cleanUrl}/health`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const latency = Math.round(performance.now() - t0);
    if (!res.ok) {
      return {
        success: false,
        latency,
        message: `HTTP Error ${res.status}: ${res.statusText}`
      };
    }

    const data = await res.json().catch(() => ({ status: 'up' }));
    return {
      success: true,
      latency,
      status: data.status,
      details: data.details,
      message: `Terhubung langsung! Latensi: ${latency}ms. Chromium: ${data.details?.chromium?.status || 'up'}, LibreOffice: ${data.details?.libreoffice?.status || 'up'}.`
    };
  } catch (err) {
    let msg = err.message;
    if (err.name === 'AbortError') {
      msg = 'Koneksi timeout (> 10 detik). Periksa status server atau firewall.';
    } else if (err.message?.includes('Failed to fetch') || err.name === 'TypeError') {
      msg = 'Gagal menghubungi server. Pastikan server aktif dan header CORS (Access-Control-Allow-Origin: *) diizinkan jika diakses langsung.';
    }
    return {
      success: false,
      latency: 0,
      message: msg
    };
  }
}

/**
 * Test Live PDF Conversion with a sample document
 * @param {string} targetUrl Gotenberg endpoint URL
 * @returns {Promise<{success: boolean, duration: number, sizeBytes?: number, pdfBlob?: Blob, message: string}>}
 */
export async function testGotenbergConvertSample(targetUrl) {
  const cleanUrl = (targetUrl || DEFAULT_GOTENBERG_URL).trim().replace(/\/+$/, '');
  if (!cleanUrl) {
    return {
      success: false,
      duration: 0,
      message: 'Harap masukkan URL Gotenberg yang valid.'
    };
  }

  // 1. Try via Edge Function proxy
  try {
    const t0 = performance.now();
    const proxyRes = await fetch('/api/test-gotenberg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: cleanUrl, action: 'convert' })
    });

    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data.ok && data.pdfBase64) {
        // Decode base64 to Blob
        const byteCharacters = atob(data.pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const pdfBlob = new Blob([byteArray], { type: 'application/pdf' });

        return {
          success: true,
          duration: data.durationMs || Math.round(performance.now() - t0),
          sizeBytes: data.sizeBytes || pdfBlob.size,
          pdfBlob,
          message: `Konversi berhasil! Dihasilkan dalam ${(data.durationMs / 1000).toFixed(2)}s (${(pdfBlob.size / 1024).toFixed(1)} KB).`
        };
      } else {
        return {
          success: false,
          duration: data.durationMs || Math.round(performance.now() - t0),
          message: data.error || 'Uji coba konversi gagal.'
        };
      }
    }
  } catch {
    // Fallback to direct client conversion
  }

  // 2. Direct client-side conversion fallback
  try {
    const t0 = performance.now();
    const sampleHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Test Gotenberg</title></head>
<body style="font-family: sans-serif; padding: 40px; text-align: center;">
  <h1 style="color: #0d9488;">DAKWAH TV EQUIPMENT</h1>
  <p>Engine konversi PDF Gotenberg beroperasi normal.</p>
  <p style="color: #64748b; font-size: 12px;">Waktu Uji: ${new Date().toLocaleString('id-ID')}</p>
</body>
</html>`;

    const formData = new FormData();
    const htmlBlob = new Blob([sampleHtml], { type: 'text/html;charset=utf-8' });
    formData.append('files', htmlBlob, 'index.html');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const res = await fetch(`${cleanUrl}/forms/chromium/convert/html`, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const duration = Math.round(performance.now() - t0);
    if (!res.ok) {
      const errTxt = await res.text().catch(() => '');
      return {
        success: false,
        duration,
        message: `HTTP ${res.status}: ${errTxt.slice(0, 200) || res.statusText}`
      };
    }

    const pdfBlob = await res.blob();
    return {
      success: true,
      duration,
      sizeBytes: pdfBlob.size,
      pdfBlob,
      message: `Konversi berhasil! Waktu proses: ${(duration / 1000).toFixed(2)}s (${(pdfBlob.size / 1024).toFixed(1)} KB).`
    };

  } catch (err) {
    let msg = err.message;
    if (err.name === 'AbortError') {
      msg = 'Konversi timeout (> 25 detik). Server mungkin sibuk.';
    } else if (err.message?.includes('Failed to fetch')) {
      msg = 'Gagal mengirim form ke Gotenberg. Pastikan CORS dan protokol (HTTP/HTTPS) sesuai.';
    }
    return {
      success: false,
      duration: 0,
      message: msg
    };
  }
}

/**
 * Trigger download of generated PDF Blob
 */
export function downloadTestPdfBlob(blob, filename = 'test-gotenberg-sample.pdf') {
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Open PDF Blob in a new browser tab for instant preview
 */
export function openPdfPreview(blob) {
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
