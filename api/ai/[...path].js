export default async function handler(req, res) {
  const railwayUrl = 'https://aistockjournal-production.up.railway.app';
  const path = req.query.path?.join('/') || '';
  const targetUrl = `${railwayUrl}/api/ai/${path}`;

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        ...req.headers,
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy request failed' });
  }
}
