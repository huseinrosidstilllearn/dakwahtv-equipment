export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;

  if (method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }

  const bearer = env.R2_WORKER_AUTH || 'Bearer DakwahTV_Aman_2026';
  const workerBase = 'https://equipment-photo-uploader.dakwahtvteknis.workers.dev';

  try {
    if (method === 'POST') {
      const formData = await request.formData();
      const forwardRes = await fetch(workerBase, {
        method: 'POST',
        headers: {
          'Authorization': bearer,
        },
        body: formData,
      });
      const data = await forwardRes.json();
      return new Response(JSON.stringify(data), {
        status: forwardRes.status,
        headers: { 'Content-Type': 'application/json' }
      });
    } else if (method === 'PUT') {
      const url = new URL(request.url);
      const pathParam = url.searchParams.get('path') || '';
      const cleanPath = pathParam.replace(/[^a-zA-Z0-9._/-]/g, '_');
      const targetUrl = cleanPath ? `${workerBase}/${cleanPath}` : workerBase;

      const bodyBuffer = await request.arrayBuffer();
      const contentType = request.headers.get('Content-Type') || 'application/octet-stream';

      const forwardRes = await fetch(targetUrl, {
        method: 'PUT',
        headers: {
          'Authorization': bearer,
          'Content-Type': contentType,
        },
        body: bodyBuffer,
      });
      const data = await forwardRes.json();
      return new Response(JSON.stringify(data), {
        status: forwardRes.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
