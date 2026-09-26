/**
 * Serializa datos para incrustarlos en el HTML dentro de un <script>
 * (`<script type="application/json">` o `window.X = ...`).
 *
 * JSON.stringify solo NO basta: si un texto contiene "</script>", el navegador
 * cierra la etiqueta ahí y lo que sigue se ejecuta como HTML/JS (XSS). Pasaba
 * con nombres de restaurante (los elige quien se registra) en el dashboard del
 * superadmin. Escapar < > & como secuencias unicode (u003c, u003e, u0026) produce JSON equivalente
 * (JSON.parse devuelve lo mismo) que nunca puede cerrar la etiqueta.
 *
 * Disponible en todas las vistas como `jsonSeguro` (app.locals).
 * Uso: <script type="application/json" id="x"><%- jsonSeguro(datos) %></script>
 */
// Las secuencias de escape unicode se arman con String.fromCharCode(92) (la
// barra invertida) para no escribir barras en el código fuente: algunas
// herramientas las convierten en el carácter literal y el escape se pierde.
const BS = String.fromCharCode(92);
const escape = hex => BS + 'u' + hex;
const LS = String.fromCharCode(0x2028); // separador de línea Unicode
const PS = String.fromCharCode(0x2029); // separador de párrafo Unicode

function jsonSeguro(datos) {
    return JSON.stringify(datos === undefined ? null : datos)
        .split('<')
        .join(escape('003c'))
        .split('>')
        .join(escape('003e'))
        .split('&')
        .join(escape('0026'))
        .split(LS)
        .join(escape('2028'))
        .split(PS)
        .join(escape('2029'));
}

module.exports = jsonSeguro;
