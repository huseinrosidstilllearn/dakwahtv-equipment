export async function uploadFileToR2(fileOrBlob, targetPath = '', options = {}) {
  // 1. Try secure Cloudflare Pages Serverless Proxy (Bearer token hidden on edge)
  try {
    const isFormData = fileOrBlob instanceof FormData;
    let res;
    if (isFormData) {
      res = await fetch('/api/upload', {
        method: 'POST',
        body: fileOrBlob,
      });
    } else {
      const cleanPath = targetPath ? encodeURIComponent(targetPath.replace(/[^a-zA-Z0-9._/-]/g, '_')) : '';
      res = await fetch(`/api/upload?path=${cleanPath}`, {
        method: 'PUT',
        headers: {
          'Content-Type': options.contentType || fileOrBlob.type || 'application/octet-stream',
        },
        body: fileOrBlob,
      });
    }

    if (res.ok) {
      const data = await res.json();
      let finalUrl = data.url;
      if (finalUrl && finalUrl.includes('.r2.dev')) {
        finalUrl = finalUrl.replace(/https:\/\/[^/]+\.r2\.dev/, 'https://spa.dakwahtv.my.id');
      }
      return { success: true, url: finalUrl, data };
    }
  } catch (e) {
    console.warn("Proxy upload failed, checking dev fallback...", e);
  }

  // 2. Local dev fallback only if VITE_R2_WORKER_AUTH is provided
  const devAuth = import.meta.env.VITE_R2_WORKER_AUTH;
  const devUrl = import.meta.env.VITE_R2_WORKER_URL || 'https://equipment-photo-uploader.dakwahtvteknis.workers.dev';
  if (!devAuth) {
    throw new Error('Upload gagal: Serverless proxy tidak merespon dan VITE_R2_WORKER_AUTH tidak disetel.');
  }

  const cleanTarget = targetPath ? `${devUrl}/${targetPath.replace(/[^a-zA-Z0-9._/-]/g, '_')}` : devUrl;
  const isFormData = fileOrBlob instanceof FormData;
  const res = await fetch(cleanTarget, {
    method: isFormData ? 'POST' : 'PUT',
    headers: {
      'Authorization': devAuth,
      ...(isFormData ? {} : { 'Content-Type': options.contentType || fileOrBlob.type || 'application/octet-stream' }),
    },
    body: fileOrBlob,
  });

  if (!res.ok) {
    throw new Error(`Upload gagal: ${res.statusText}`);
  }

  const data = await res.json();
  let finalUrl = data.url;
  if (finalUrl && finalUrl.includes('.r2.dev')) {
    finalUrl = finalUrl.replace(/https:\/\/[^/]+\.r2\.dev/, 'https://spa.dakwahtv.my.id');
  }
  return { success: true, url: finalUrl, data };
}
