-- Migration: 108_producto_auditoria.sql
-- Registro inmutable de creación/edición/baja de productos (mismo patrón que
-- pedido_item_pagos, pedido_abonos, bono_movimientos: un evento por fila, no
-- se actualiza ni se borra). No existía ningún rastro de quién cambiaba un
-- producto ni qué campos, ni forma de ver el catálogo completo desde
-- superadmin cruzando todos los tenants -- este es el soporte de datos para
-- el nuevo módulo /admin/productos.

CREATE TABLE IF NOT EXISTS producto_auditoria (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    producto_id INT NOT NULL,
    accion ENUM('creado', 'actualizado', 'desactivado', 'reactivado') NOT NULL,
    usuario_id INT NULL,
    cambios JSON NULL COMMENT 'Diff por campo (antes/despues). NULL en creado.',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    INDEX idx_producto_auditoria_producto (producto_id, created_at)
);
