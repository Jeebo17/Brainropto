import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import fetch from 'node-fetch';

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const PANOPTO_BASE = 'https://uniofbath.cloud.panopto.eu';
const CLIENT_ID = process.env.PANOPTO_CLIENT_ID;
const CLIENT_SECRET = process.env.PANOPTO_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3001/auth/callback';

// In-memory token storage (single user for now)
let accessToken = null;
let refreshToken = null;
let tokenExpiry = 0;

// ---------- Auth routes ----------

// Step 1: Redirect user to Panopto login
app.get('/auth/login', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: 'openid api',
    state,
  });

  res.redirect(`${PANOPTO_BASE}/Panopto/oauth2/connect/authorize?${params}`);
});

// Step 2: Panopto redirects back here with an auth code
app.get('/auth/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error || !code) {
    return res.status(400).send(`Auth failed: ${error || 'no code received'}`);
  }

  try {
    const tokenRes = await fetch(`${PANOPTO_BASE}/Panopto/oauth2/connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
    });

    const text = await tokenRes.text();
    console.log('Token response status:', tokenRes.status);
    console.log('Token response body:', text);

    if (!tokenRes.ok) {
      return res.status(400).send(`Token exchange failed (${tokenRes.status}): ${text}`);
    }

    const data = JSON.parse(text);
    accessToken = data.access_token;
    refreshToken = data.refresh_token || null;
    tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;

    // Redirect to the frontend app
    res.redirect('http://localhost:5173');
  } catch (err) {
    console.error('Callback error:', err);
    res.status(500).send(`Callback error: ${err.message}`);
  }
});

// Check if user is authenticated
app.get('/auth/status', (req, res) => {
  res.json({ authenticated: !!accessToken && Date.now() < tokenExpiry });
});

// ---------- Token helper ----------

async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }

  // Try refresh if we have a refresh token
  if (refreshToken) {
    console.log('Refreshing access token...');
    const res = await fetch(`${PANOPTO_BASE}/Panopto/oauth2/connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      accessToken = data.access_token;
      refreshToken = data.refresh_token || refreshToken;
      tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
      return accessToken;
    }
  }

  throw new Error('Not authenticated. Visit http://localhost:3001/auth/login first.');
}

// ---------- API routes ----------

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
  console.log(`Login at: http://localhost:${PORT}/auth/login`);
});
