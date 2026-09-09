export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { target, message, countryCode = '62' } = body;
    if (!target || !message) {
      return new Response(JSON.stringify({ status: false, message: 'Target and message required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Secret Token read from Cloudflare Pages Environment Variables
    const token = context.env.FONNTE_TOKEN || '6zWjLzHFtYJavkm7y3qT';

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
