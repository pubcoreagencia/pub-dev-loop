export default {
  async fetch(request, env) {
    const upstream = env.UPSTREAM_URL;
    if (!upstream) {
      return new Response('UPSTREAM_URL not configured', { status: 500 });
    }
    const url = new URL(request.url);
    const targetUrl = new URL(url.pathname + url.search, upstream);
    const init = {
      method: request.method,
      headers: new Headers(request.headers),
      body: request.body,
      redirect: 'manual',
    };
    const apiKey = env.ROUTER_API_KEY;
    if (apiKey) {
      init.headers.set('Authorization', `Bearer ${apiKey}`);
    }
    const resp = await fetch(targetUrl.toString(), init);
    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: resp.headers,
    });
  },
};
