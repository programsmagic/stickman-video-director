#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = path.resolve();
const CLIENT_SECRET_PATH = path.join(ROOT_DIR, 'client_secret.json');
const TOKEN_PATH = path.join(ROOT_DIR, 'token.json');

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.force-ssl',
];

const PORT = 8085;
const REDIRECT_URI = `http://localhost:${PORT}`;

async function main() {
  if (!fs.existsSync(CLIENT_SECRET_PATH)) {
    console.error('client_secret.json not found!');
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(CLIENT_SECRET_PATH, 'utf8'));
  const config = raw.installed || raw.web;
  const clientId = config.client_id;
  const clientSecret = config.client_secret;

  const authUrl = new URL('https://accounts.google.com/o/oauth2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES.join(' '));
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  console.log('\n=======================================================');
  console.log('GOOGLE YOUTUBE OAUTH2 RE-AUTHENTICATION');
  console.log('=======================================================');
  console.log('Please open this URL in your browser to authorize YouTube upload:\n');
  console.log(authUrl.toString());
  console.log('\nWaiting for browser callback on ' + REDIRECT_URI + ' ...\n');

  const server = http.createServer(async (req, res) => {
    try {
      const reqUrl = new URL(req.url, REDIRECT_URI);
      const code = reqUrl.searchParams.get('code');
      const error = reqUrl.searchParams.get('error');

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`<h1>Authentication Failed</h1><p>${error}</p>`);
        console.error('OAuth error from Google:', error);
        server.close();
        process.exit(1);
      }

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #0f172a; color: white;">
              <h1 style="color: #38bdf8;">Authentication Successful!</h1>
              <p>Your YouTube token has been refreshed and saved. You can close this tab now.</p>
            </body>
          </html>
        `);

        console.log('Authorization code received! Exchanging for tokens...');
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code: code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code',
          }),
        });

        const tokenData = await tokenRes.json();
        if (tokenData.access_token) {
          const toSave = {
            token: tokenData.access_token,
            refresh_token: tokenData.refresh_token || raw.refresh_token,
            token_uri: 'https://oauth2.googleapis.com/token',
            client_id: clientId,
            client_secret: clientSecret,
            scopes: SCOPES,
            expiry: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString(),
          };

          fs.writeFileSync(TOKEN_PATH, JSON.stringify(toSave, null, 2), 'utf8');
          console.log(`✓ New token successfully written to ${TOKEN_PATH}`);
          console.log('✓ Authentication complete!');
          server.close();
          process.exit(0);
        } else {
          console.error('Failed to exchange code:', tokenData);
          server.close();
          process.exit(1);
        }
      }
    } catch (err) {
      console.error('Error handling request:', err);
      res.writeHead(500);
      res.end('Server error');
    }
  });

  server.listen(PORT, () => {
    // Attempt to open the URL in the default browser on macOS
    import('node:child_process').then(cp => {
      cp.exec(`open "${authUrl.toString()}"`);
    }).catch(() => {});
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

