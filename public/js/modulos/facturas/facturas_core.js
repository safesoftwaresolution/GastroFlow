// Core states and storage for Facturas module

window.FacturasModule = {
  pedidosGuardados: JSON.parse(localStorage.getItem('pedidos') || '[]'),
  productosFactura: [],
  totalFactura: 0,
  timeoutCliente: null,
  timeoutProducto: null,
  currentStep: 1,

  guardarSesionProvisional() {
    const sesion = {
      productos: this.productosFactura,
      clienteId: $('#cliente_id').val(),
      clienteNombre: $('#cliente').val(),
      direccion: $('#direccionCliente').text(),
      telefono: $('#telefonoCliente').text()
    };
    localStorage.setItem('pos_sesion_provisional', JSON.stringify(sesion));
  },

  cargarSesionProvisional() {
    const data = localStorage.getItem('pos_sesion_provisional');
    if (!data) return;
    try {
      const sesion = JSON.parse(data);
      if (sesion.productos?.length > 0) {
        this.productosFactura = sesion.productos;
        if (typeof this.actualizarTablaProductos === 'function') this.actualizarTablaProductos();
      }
      if (sesion.clienteId && typeof window.seleccionarCliente === 'function') {
        window.seleccionarCliente({
          id: sesion.clienteId,
          nombre: sesion.clienteNombre,
          direccion: sesion.direccion,
          telefono: sesion.telefono
        });
      }
    } catch (e) { console.error("Error cargando sesión provisional", e); }
  },

  limpiarSesionProvisional() {
    localStorage.removeItem('pos_sesion_provisional');
  },

  actualizarLocalStorage() {
    localStorage.setItem('pedidos', JSON.stringify(this.pedidosGuardados));
  },

  getOrCreateConsumidorFinal() {
    return GF.api('/api/clientes/buscar?q=consumidor%20final')
      .then(list => {
        const cf = (list || []).find(c => (c.nombre || '').toLowerCase() === 'consumidor final');
        return cf || GF.api.post('/api/clientes', { nombre: 'Consumidor final' });
      })
      .catch(() => null);
  },

  subtotalLinea(item) {
    const bruto = item.cantidad * item.precio;
    if (item.descuento_valor > 0) {
      return Math.max(0, bruto - item.descuento_valor);
    }
    return bruto * (1 - (item.descuento_porcentaje || 0) / 100);
  }
};
