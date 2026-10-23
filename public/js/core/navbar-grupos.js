/**
 * Secciones plegables del menú en móvil (.nav-grupo). En escritorio los grupos no tienen caja,
 * así que esto solo tiene efecto visible por debajo de 992px.
 * Abre por defecto la sección de la página actual.
 */
(function () {
    function enlaceActivo(grupo) {
        var ruta = window.location.pathname.replace(/\/+$/, '') || '/';
        return Array.prototype.some.call(grupo.querySelectorAll('a.nav-link'), function (a) {
            var href = (a.getAttribute('href') || '').replace(/\/+$/, '');
            return href && href !== '/' && (ruta === href || ruta.indexOf(href + '/') === 0);
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('.nav-grupo').forEach(function (grupo) {
            var boton = grupo.querySelector('.nav-grupo-h');
            if (!boton) return;
            function fijar(abierto) {
                grupo.classList.toggle('abierto', abierto);
                boton.setAttribute('aria-expanded', abierto ? 'true' : 'false');
            }
            boton.addEventListener('click', function () {
                fijar(!grupo.classList.contains('abierto'));
            });
            if (enlaceActivo(grupo)) fijar(true);
        });
    });
})();
