export async function onRequestPut(context) {
  try {
    const url = new URL(context.request.url);
    const filename = url.searchParams.get('filename');
    if (!filename) {
      return new Response(JSON.stringify({ error: 'Filename parameter required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const cleanName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const bearer = context.env.R2_WORKER_AUTH || 'Bearer DakwahTV_Aman_2026';
    const uploadUrl = `https://equipment-photo-uploader.dakwahtvteknis.workers.dev/spa-pdfs/${cleanName}`;

    const pdfBuffer = await context.request.arrayBuffer();

    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': bearer,
        'Content-Type': 'application/pdf'
      },
      body: pdfBuffer
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
