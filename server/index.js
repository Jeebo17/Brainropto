import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
app.use(cors());
app.use(express.json());

const PANOPTO_BASE = 'https://uniofbath.cloud.panopto.eu';
const CLIENT_ID = process.env.PANOPTO_CLIENT_ID;
const CLIENT_SECRET = process.env.PANOPTO_CLIENT_SECRET;

let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const res = await fetch(`${PANOPTO_BASE}/Panopto/oauth2/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth token request failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  // Expire 60s early to be safe
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

// GET /api/video/:sessionId — returns a stream URL for the given Panopto session
app.get('/api/video/:sessionId', async (req, res) => {
  try {
    const token = await getAccessToken();
    const { sessionId } = req.params;

    // Get session delivery info (contains podcast/stream URLs)
    const deliveryRes = await fetch(
      `${PANOPTO_BASE}/Panopto/api/v1/sessions/${sessionId}/deliveries`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!deliveryRes.ok) {
      const text = await deliveryRes.text();
      return res.status(deliveryRes.status).json({
        error: `Panopto API error (${deliveryRes.status})`,
        details: text,
      });
    }

    const deliveries = await deliveryRes.json();

    // Look for a podcast (MP4) URL first, fall back to streaming URL
    let videoUrl = null;

    for (const delivery of deliveries) {
      if (delivery.StreamUrl) {
        videoUrl = delivery.StreamUrl;
        break;
      }
    }

    if (!videoUrl) {
      // Try the session's podcast download URL instead
      const sessionRes = await fetch(
        `${PANOPTO_BASE}/Panopto/api/v1/sessions/${sessionId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (sessionRes.ok) {
        const session = await sessionRes.json();
        // The IOS/MP4 podcast URL is often available
        if (session.Urls?.PodcastUrl) {
          videoUrl = session.Urls.PodcastUrl;
        } else if (session.Urls?.StreamUrl) {
          videoUrl = session.Urls.StreamUrl;
        }
      }
    }

    if (!videoUrl) {
      return res.status(404).json({ error: 'No video URL found for this session' });
    }

    res.json({ videoUrl });
  } catch (err) {
    console.error('Error fetching video URL:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions/search?q=... — search for sessions by name
app.get('/api/sessions/search', async (req, res) => {
  try {
    const token = await getAccessToken();
    const query = req.query.q || '';

    const searchRes = await fetch(
      `${PANOPTO_BASE}/Panopto/api/v1/sessions/search?searchQuery=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!searchRes.ok) {
      const text = await searchRes.text();
      return res.status(searchRes.status).json({ error: text });
    }

    const data = await searchRes.json();
    const sessions = (data.Results || []).map((s) => ({
      id: s.Id,
      name: s.Name,
      duration: s.Duration,
      folder: s.FolderName,
    }));

    res.json({ sessions });
  } catch (err) {
    console.error('Error searching sessions:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Panopto proxy server running on http://localhost:${PORT}`);
});
