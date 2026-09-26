// Tablas responsive (ver public/css/core/tablas-responsive.css).
//
// En pantallas angostas, una tabla que no cabe en su contenedor pasa a verse
// como tarjetas: se le agrega .tabla-apilada y cada <td> recibe data-label con
// el texto de su encabezado. Las tablas que sí caben se dejan como tabla.
//
// - Automático para todas las tablas de la página, incluidas las que se
//   llenan o reemplazan por AJAX (MutationObserver) y las que están en
//   pestañas ocultas (ResizeObserver re-evalúa cuando se hacen visibles).
// - Se excluyen tablas dentro de modales/offcanvas/SweetAlert (suelen tener
//   campos editables y ya están diseñadas para ese espacio) y las que tengan
//   la clase .no-stack (en la tabla o en un contenedor).
(function () {
    'use strict';

    var BREAKPOINT = 768;
    var EXCLUIR = '.modal, .offcanvas, .swal2-container, .no-stack';

    function esCandidata(table) {
        return !table.closest(EXCLUIR) && !table.classList.contains('no-stack');
    }

    function encabezados(table) {
        var thead = table.tHead;
        if (!thead || !thead.rows.length) return null;
        // Última fila del thead (la más específica si hay encabezados agrupados),
        // expandiendo colspan para que el índice coincida con las celdas del body.
        var fila = thead.rows[thead.rows.length - 1];
        var etiquetas = [];
        Array.prototype.forEach.call(fila.cells, function (th) {
            var texto = (th.getAttribute('data-label') || th.textContent || '').replace(/\s+/g, ' ').trim();
            for (var i = 0; i < (th.colSpan || 1); i++) etiquetas.push(texto);
        });
        return etiquetas;
    }

    function etiquetar(table) {
        var etiquetas = encabezados(table);
        if (!etiquetas) return;
        Array.prototype.forEach.call(table.tBodies, function (tbody) {
            Array.prototype.forEach.call(tbody.rows, function (tr) {
                var celdas = tr.cells;
                // Fila de "sin datos" / separador: una sola celda que abarca casi todo
                tr.classList.toggle('fila-unica', celdas.length === 1 && (celdas[0].colSpan || 1) > 1);
                var col = 0;
                Array.prototype.forEach.call(celdas, function (td) {
                    if (!td.hasAttribute('data-label') || td.dataset.labelAuto === '1') {
                        td.setAttribute('data-label', etiquetas[col] || '');
                        td.dataset.labelAuto = '1';
                    }
                    col += td.colSpan || 1;
                });
            });
        });
    }

    function evaluar(table) {
        if (!esCandidata(table)) return;
        if (window.innerWidth >= BREAKPOINT) {
            table.classList.remove('tabla-apilada');
            return;
        }
        etiquetar(table);
        var contenedor = table.parentElement;
        if (!contenedor) return;

        if (!table.offsetParent) {
            // Oculta (pestaña inactiva): decidir por número de columnas; el
            // ResizeObserver la vuelve a evaluar con medidas reales al mostrarse.
            var etiquetas = encabezados(table);
            table.classList.toggle('tabla-apilada', !!etiquetas && etiquetas.length >= 4);
            return;
        }

        // Medir como tabla normal (se quita la clase y se vuelve a poner en el
        // mismo frame: el navegador no alcanza a pintar el cambio).
        table.classList.remove('tabla-apilada');
        // Se compara contra el contenedor Y contra el borde visible de la
        // pantalla: a veces el contenedor crece al ancho de la tabla (hijo de
        // flex/grid) y es un ancestro con overflow:hidden el que la recorta.
        var izquierda = Math.max(0, table.getBoundingClientRect().left);
        var disponible = Math.min(contenedor.clientWidth, document.documentElement.clientWidth - izquierda);
        var desborda = table.scrollWidth > disponible + 2;
        table.classList.toggle('tabla-apilada', desborda);
    }

    var anchoPrevio = new WeakMap();
    var resizeObserver = 'ResizeObserver' in window
        ? new ResizeObserver(function (entradas) {
              entradas.forEach(function (e) {
                  var ancho = Math.round(e.contentRect.width);
                  // Solo cambios de ANCHO: apilar cambia el alto y no debe re-disparar.
                  if (anchoPrevio.get(e.target) === ancho) return;
                  anchoPrevio.set(e.target, ancho);
                  var t = e.target.tagName === 'TABLE' ? e.target : e.target.querySelector(':scope > table');
                  if (t) evaluar(t);
              });
          })
        : null;

    var observadas = new WeakSet();

    function procesarTodo() {
        document.querySelectorAll('table').forEach(function (table) {
            if (!esCandidata(table)) return;
            if (resizeObserver && !observadas.has(table) && table.parentElement) {
                observadas.add(table);
                resizeObserver.observe(table.parentElement);
            }
            evaluar(table);
        });
    }

    var pendiente = false;
    function programar() {
        if (pendiente) return;
        pendiente = true;
        window.requestAnimationFrame(function () {
            pendiente = false;
            procesarTodo();
        });
    }

    function iniciar() {
        procesarTodo();
        // Filas/tablas nuevas por AJAX. Se ignoran los cambios de atributos
        // (los propios data-label/clases que pone este script).
        new MutationObserver(function (mutaciones) {
            for (var i = 0; i < mutaciones.length; i++) {
                if (mutaciones[i].addedNodes.length) {
                    programar();
                    return;
                }
            }
        }).observe(document.body, { childList: true, subtree: true });

        // Las fuentes web (ej. Plus Jakarta Sans del panel admin) llegan después
        // y ensanchan el texto: una tabla que "cabía" con la fuente de respaldo
        // puede dejar de caber. Se re-evalúa cuando terminan de cargar.
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(programar);
        window.addEventListener('load', programar);

        var t;
        window.addEventListener('resize', function () {
            clearTimeout(t);
            t = setTimeout(procesarTodo, 150);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else {
        iniciar();
    }
})();
