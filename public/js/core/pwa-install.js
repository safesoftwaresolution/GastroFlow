// Banner "Instalar GastroFlow" + registro del service worker.
// Android/Chrome/Brave: usa beforeinstallprompt. iOS Safari no lo soporta,
// ahí se muestran las instrucciones de "Añadir a pantalla de inicio".
(function () {
    'use strict';

    var CLAVE = 'gf_pwa_descartado';
    var DIAS_OCULTO = 7;

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
            navigator.serviceWorker.register('/sw.js').catch(function () {});
        });
    }

    var instalada = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    if (instalada) return;

    function descartadoReciente() {
        try {
            var t = parseInt(localStorage.getItem(CLAVE), 10);
            return t && Date.now() - t < DIAS_OCULTO * 86400000;
        } catch (_) { return false; }
    }
    function recordarDescarte() {
        try { localStorage.setItem(CLAVE, String(Date.now())); } catch (_) {}
    }

    var evento = null;
    var banner = null;

    function crearBanner(textoBoton, subtitulo, alClick) {
        if (banner || descartadoReciente()) return;

        var css = document.createElement('style');
        css.textContent =
            '.gf-pwa{position:fixed;left:12px;right:12px;bottom:12px;z-index:2000;max-width:520px;margin:0 auto;' +
            'display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:18px;background:#0f172a;color:#fff;' +
            'box-shadow:0 10px 30px rgba(0,0,0,.35);font-family:system-ui,sans-serif}' +
            '.gf-pwa img{width:44px;height:44px;border-radius:12px;flex:none}' +
            '.gf-pwa div{flex:1;min-width:0}.gf-pwa b{display:block;font-size:.95rem}' +
            '.gf-pwa small{display:block;opacity:.7;font-size:.78rem;line-height:1.25}' +
            '.gf-pwa button{border:0;cursor:pointer;font:inherit}' +
            '.gf-pwa .gf-pwa-ok{background:#16a34a;color:#fff;font-weight:700;padding:9px 16px;border-radius:999px}' +
            '.gf-pwa .gf-pwa-x{background:none;color:#fff;opacity:.7;font-size:1.3rem;padding:4px 8px}';
        document.head.appendChild(css);

        banner = document.createElement('div');
        banner.className = 'gf-pwa';
        banner.setAttribute('role', 'dialog');
        banner.innerHTML =
            '<img src="/icons/icon-192.png" alt="">' +
            '<div><b>Instala GastroFlow</b><small></small></div>' +
            '<button type="button" class="gf-pwa-ok"></button>' +
            '<button type="button" class="gf-pwa-x" aria-label="Cerrar">&times;</button>';
        banner.querySelector('small').textContent = subtitulo;
        var ok = banner.querySelector('.gf-pwa-ok');
        ok.textContent = textoBoton;
        ok.addEventListener('click', alClick);
        banner.querySelector('.gf-pwa-x').addEventListener('click', function () {
            recordarDescarte();
            cerrar();
        });
        document.body.appendChild(banner);
    }

    function cerrar() {
        if (banner) { banner.remove(); banner = null; }
    }

    window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault();
        evento = e;
        crearBanner('Instalar', 'Acceso directo en tu pantalla de inicio', function () {
            if (!evento) return;
            evento.prompt();
            evento.userChoice.then(function (r) {
                if (r.outcome !== 'accepted') recordarDescarte();
                evento = null;
                cerrar();
            });
        });
    });

    window.addEventListener('appinstalled', function () {
        evento = null;
        cerrar();
    });

    var esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    if (esIOS) {
        document.addEventListener('DOMContentLoaded', function () {
            crearBanner('Cómo', 'Toca Compartir y luego "Añadir a pantalla de inicio"', function () {
                alert('En Safari toca el botón Compartir y elige "Añadir a pantalla de inicio".');
                recordarDescarte();
                cerrar();
            });
        });
    }
})();
