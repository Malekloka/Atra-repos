require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const templating = require('./server.templating')
const routing = require('./server.routing.js');

const app = express();

const TENANT_COOKIE = 'tenantId';

const getCookieValue = (cookieHeader, name) => {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map((part) => part.trim());
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.split('=');
    if (key === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
};

const setTenantCookie = (res, tenantId) => {
  const cookieValue = `${TENANT_COOKIE}=${encodeURIComponent(tenantId)}; Path=/`;
  const existing = res.getHeader('Set-Cookie');
  if (!existing) {
    res.setHeader('Set-Cookie', cookieValue);
    return;
  }
  if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, cookieValue]);
    return;
  }
  res.setHeader('Set-Cookie', [existing, cookieValue]);
};

app.use((req, res, next) => {
  const match = req.url.match(/^\/t\/([^/]+)(\/|$)/);
  if (match) {
    const tenantId = decodeURIComponent(match[1]);
    req.tenantId = tenantId;
    req.url = req.url.replace(/^\/t\/[^/]+/, '') || '/';
    setTenantCookie(res, tenantId);
  } else {
    req.tenantId = getCookieValue(req.headers.cookie, TENANT_COOKIE) || 'demo';
  }
  next();
});

templating.useTemplates(app)

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

app.use(routing);

const port = process.env.PORT || 8000;
app.listen(port, () => {
  console.log('listening on http://localhost:'+port);
});


