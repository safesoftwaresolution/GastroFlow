// Service worker mínimo: lo exige el navegador para ofrecer "Instalar aplicación".
// No cachea nada a propósito: la app es multi-tenant con sesión y datos en vivo
// (SSE, caja, cocina), así que todo va directo a la red.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
