// Shared states, utility methods and API wrapper for the Costeo module

(function () {
    const el = document.getElementById('costeo-data');
    if (el) {
        const d = JSON.parse(el.textContent);
        window.USER_PERMISOS = d.userPermisos;
        window.USER_ROL = d.userRol;
        window.COSTEO_TENANT_ID = d.tenantId;
        window.COSTEO_SHOW_TENANT_SELECTOR = d.showTenantSelector;
        window.COSTEO_PLANTILLA_REPOSTERIA = d.plantillaReposteria;
    }
})();

window.CosteoModule = {
  base: '/costeo',
  permisos: (function () {
    let p = window.USER_PERMISOS;
    if (typeof p === 'string') try { p = JSON.parse(p); } catch (_) { p = []; }
    return Array.isArray(p) ? p : [];
  })(),
  userRol: (typeof window.USER_ROL === 'string' ? window.USER_ROL : '') || '',
  isSuperadmin: String(window.USER_ROL || '').toLowerCase() === 'superadmin',
  canEdit: false,
  canViewCosteo: false,
  canEditReceta: false,
  insumosList: [],
  recetaIngredientes: [],

  /**
   * GF.api con la URL del módulo; el superadmin opera sobre el tenant elegido
   * en el selector (tenant_id), que es lo único propio de Costeo.
   */
  api(path, options = {}) {
    let url = this.base + path;
    if (this.isSuperadmin && window.COSTEO_TENANT_ID) {
      url += (path.indexOf('?') >= 0 ? '&' : '?') + 'tenant_id=' + window.COSTEO_TENANT_ID;
    }
    return GF.api(url, options, 'Error del servidor');
  },


  /** Montos de costeo: pueden tener centavos (costo por porción); '-' si no hay dato. */
  formatMoney(n) {
    return n == null || Number.isNaN(n) ? '-' : GF.dinero(n, 2);
  },

  showToast(msg, type) {
    const el = document.createElement('div');
    el.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    el.style.cssText = 'top: 1rem; right: 1rem; z-index: 9999; min-width: 200px;';
    el.innerHTML = msg + '<button type="button" class="btn-close" data-bs-dismiss="alert"></button>';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }
};

window.CosteoModule.canEdit = window.CosteoModule.permisos.includes('costeo.editar') || window.CosteoModule.isSuperadmin;
window.CosteoModule.canViewCosteo = window.CosteoModule.permisos.includes('costeo.ver') || window.CosteoModule.isSuperadmin;
window.CosteoModule.canEditReceta = window.CosteoModule.canViewCosteo || window.CosteoModule.canEdit || true;
