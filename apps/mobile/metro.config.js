const { getDefaultConfig } = require('expo/metro-config');
const http = require('http');

const apiPrefixes = ['/auth', '/health', '/users', '/therapists', '/catalog', '/marketplace', '/assessment', '/conversations', '/admin'];
const config = getDefaultConfig(__dirname);
const originalEnhanceMiddleware = config.server && config.server.enhanceMiddleware;

config.server = {
  ...(config.server || {}),
  enhanceMiddleware(middleware, server) {
    const baseMiddleware = originalEnhanceMiddleware ? originalEnhanceMiddleware(middleware, server) : middleware;
    return (req, res, next) => {
      const url = req.url || '';
      const isApi = apiPrefixes.some((prefix) => url === prefix || url.startsWith(prefix + '/'));
      if (!isApi) return baseMiddleware(req, res, next);

      const proxyReq = http.request({
        hostname: '127.0.0.1',
        port: 3001,
        path: url,
        method: req.method,
        headers: req.headers
      }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (error) => {
        res.writeHead(502, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ message: 'API proxy error', detail: error.message }));
      });

      req.pipe(proxyReq);
    };
  }
};

module.exports = config;
