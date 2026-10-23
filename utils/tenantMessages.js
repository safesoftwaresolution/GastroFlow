/**
 * Mensaje mostrado cuando el login/acceso de un tenant se bloquea. Diferencia
 * entre un local pendiente de aprobación (auto-registro), uno rechazado, y
 * uno desactivado manualmente por el superadmin (comportamiento original).
 * Related to: AuthController.login, middleware/tenant.js attachTenantContext
 */
function getTenantBlockedMessage(tenant) {
    const nombre = tenant?.nombre || '';
    if (tenant?.estado_aprobacion === 'pendiente') {
        return `Tu restaurante "${nombre}" está en revisión. Te avisaremos por correo apenas sea aprobado.`;
    }
    if (tenant?.estado_aprobacion === 'rechazado') {
        return `Tu solicitud para "${nombre}" no fue aprobada. ${tenant.motivo_rechazo || 'Contáctanos para más información.'}`;
    }
    if (tenant?.suspendido_por_pago) {
        return `Tu suscripción a GastroFlow venció. Actualiza tu método de pago para reactivar "${nombre}".`;
    }
    return `Tu restaurante "${nombre}" está desactivado. Contacta al administrador.`;
}

/**
 * Una sucursal depende de su restaurante padre: si el padre está desactivado o suspendido por
 * pago, la sucursal tampoco puede operar (al revés no aplica). Devuelve el mensaje de bloqueo
 * o null. `buscarTenant` resuelve un tenant por id (con caché en el middleware).
 */
async function getBloqueoPorPadre(tenant, buscarTenant) {
    if (!tenant?.tenant_padre_id) {
        return null;
    }
    const padre = await buscarTenant(tenant.tenant_padre_id);
    if (!padre) {
        return `La cuenta principal de "${tenant.nombre}" no existe. Contacta al administrador.`;
    }
    if (!padre.activo) {
        const motivo = padre.suspendido_por_pago ? 'suspendida por falta de pago' : 'desactivada';
        return `La cuenta principal "${padre.nombre}" está ${motivo}, por eso "${tenant.nombre}" no está disponible. Contacta al administrador.`;
    }
    return null;
}

module.exports = { getTenantBlockedMessage, getBloqueoPorPadre };
