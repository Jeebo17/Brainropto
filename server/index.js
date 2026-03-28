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

    console.log(`Fetching session: ${sessionId}`);

    // Get session details
    const sessionRes = await fetch(
      `${PANOPTO_BASE}/Panopto/api/v1/sessions/${sessionId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const sessionText = await sessionRes.text();
    console.log('Session response status:', sessionRes.status);
    console.log('Session response body:', sessionText.substring(0, 2000));

    if (!sessionRes.ok) {
      return res.status(sessionRes.status).json({
        error: `Panopto API error (${sessionRes.status})`,
        details: sessionText,
      });
    }

    const session = JSON.parse(sessionText);

    // Log all available keys and URLs for debugging
    console.log('Session keys:', Object.keys(session));
    console.log('Session Urls:', JSON.stringify(session.Urls, null, 2));
    console.log('Session IosVideoUrl:', session.IosVideoUrl);
    console.log('Session Mp4Url:', session.Mp4Url);

    // Try all known URL fields
    const videoUrl =
      session.Urls?.PodcastUrl ||
      session.Urls?.StreamUrl ||
      session.Urls?.DownloadUrl ||
      session.Urls?.IOSVideoUrl ||
      session.Urls?.VideoUrl ||
      session.Urls?.Mp4Url ||
      session.IosVideoUrl ||
      session.Mp4Url ||
      null;

    if (!videoUrl) {
      return res.status(404).json({
        error: 'No video URL found in session data',
        availableUrls: session.Urls || null,
        allKeys: Object.keys(session),
      });
    }

    res.json({ videoUrl });
  } catch (err) {
    console.error('Error fetching video URL:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stream/:sessionId — proxy the actual video bytes through the server
app.get('/api/stream/:sessionId', async (req, res) => {
  try {
    const token = await getAccessToken();
    const { sessionId } = req.params;

    // Get the video URL first
    const sessionRes = await fetch(
      `${PANOPTO_BASE}/Panopto/api/v1/sessions/${sessionId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!sessionRes.ok) {
      return res.status(sessionRes.status).send('Session not found');
    }

    const session = await sessionRes.json();
    const videoUrl =
      session.Urls?.PodcastUrl ||
      session.Urls?.StreamUrl ||
      session.Urls?.DownloadUrl ||
      session.Urls?.IOSVideoUrl ||
      session.Urls?.VideoUrl ||
      session.IosVideoUrl ||
      null;

    if (!videoUrl) {
      return res.status(404).send('No video URL found');
    }

    console.log('Proxying video from:', videoUrl);

    // Proxy the video, passing through range headers for seeking
    const headers = { Authorization: `Bearer ${token}` };
    if (req.headers.range) {
      headers.Range = req.headers.range;
    }

    const videoRes = await fetch(videoUrl, { headers, redirect: 'follow' });

    console.log('Video proxy response status:', videoRes.status);
    console.log('Video proxy content-type:', videoRes.headers.get('content-type'));
    console.log('Video proxy content-length:', videoRes.headers.get('content-length'));

    // If Panopto returned HTML instead of video, it needs cookie auth
    const contentType = videoRes.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      console.log('ERROR: Panopto returned HTML — download URL needs cookie auth, not Bearer token');
      return res.status(403).json({ error: 'Panopto download requires browser session auth. Bearer token was rejected.' });
    }

    // Forward status and relevant headers
    res.status(videoRes.status);
    const contentLength = videoRes.headers.get('content-length');
    const contentRange = videoRes.headers.get('content-range');
    const acceptRanges = videoRes.headers.get('accept-ranges');

    if (contentType) res.set('Content-Type', contentType);
    if (contentLength) res.set('Content-Length', contentLength);
    if (contentRange) res.set('Content-Range', contentRange);
    if (acceptRanges) res.set('Accept-Ranges', acceptRanges);

    // Pipe the video stream to the client
    videoRes.body.pipe(res);
  } catch (err) {
    console.error('Stream proxy error:', err);
    res.status(500).send(err.message);
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
