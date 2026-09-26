// API fetch calls for Mesas module

window.MesasModule.abrirPedido = async function(mesaId, mesaNumero) {
  try {
    this.descuentosPorItem = {};
    this.propinaPedido = 0;
    this.clienteActual = { id: null, nombre: 'Consumidor Final' };
    if (typeof this.actualizarUICliente === 'function') this.actualizarUICliente();

    const data = await GF.api('/api/mesas/abrir', { method: 'POST', body: { mesa_id: mesaId } }, 'Error al abrir pedido');
    this.pedidoActual = data.pedido;
    this.pedidoAbiertoAt = Date.now();
    this.cerradaStreak = 0;
    $('#pedidoMesa').text(mesaNumero);

    const $btnLiberar = $('#btnLiberarMesaHeader');
    if ($btnLiberar.length) $btnLiberar.prop('disabled', this.currentMesaEstado === 'libre').toggleClass('d-none', this.currentMesaEstado === 'libre');

    await this.cargarPedido(this.pedidoActual.id);
    if (this.canvas) this.canvas.show();
  } catch (err) {
    Swal.fire({ icon: 'error', title: err.message });
  }
};

window.MesasModule.cargarPedido = async function(pedidoId) {
  try {
    const data = await GF.api(`/api/mesas/pedidos/${pedidoId}`, {}, 'Error al cargar pedido');
    this.items = data.items || [];
    this.abonos = data.abonos || [];
    this.propinaPedido = Number(data.pedido?.propina) || 0;

    if (data.pedido?.cliente_id) {
      this.clienteActual = { id: data.pedido.cliente_id, nombre: data.pedido.cliente_nombre || 'Consumidor Final' };
    } else {
      this.clienteActual = { id: null, nombre: 'Consumidor Final' };
    }
    if (typeof this.actualizarUICliente === 'function') this.actualizarUICliente();
    
    if (this.items.length > 0) {
      this.currentMesaEstado = 'ocupada';
    } else {
      this.currentMesaEstado = 'libre';
    }

    const $btnLiberar = $('#btnLiberarMesaHeader');
    if ($btnLiberar.length) $btnLiberar.prop('disabled', this.currentMesaEstado === 'libre').toggleClass('d-none', this.currentMesaEstado === 'libre');

    const $btnLimpiar = $('#btnLimpiarPedidoHeader');
    if ($btnLimpiar.length) $btnLimpiar.toggleClass('d-none', this.items.length === 0);

    if (typeof this.renderItems === 'function') this.renderItems();
  } catch (err) {
    Swal.fire({ icon: 'error', title: err.message });
  }
};

window.MesasModule.liberarMesa = async function(mesaId, mesaNum) {
  const ok = await Swal.fire({ title: `Liberar mesa ${mesaNum}?`, text: 'Solo si no tiene items activos', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, liberar' });
  if (!ok.isConfirmed) return;
  try {
    const data = await GF.api(`/api/mesas/${mesaId}/liberar`, { method: 'PUT' }, 'No se pudo liberar');
    Swal.fire({ icon: 'success', title: 'Mesa liberada' }).then(() => {
      if (typeof refreshMesas === 'function') refreshMesas();
      else location.reload();
    });
  } catch (err) {
    Swal.fire({ icon: 'error', title: err.message });
  }
};
