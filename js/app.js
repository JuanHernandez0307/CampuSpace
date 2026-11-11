// Enrutador y eventos de CampuSpace
(function () {
  const S = CS.S, V = CS.views, A = () => CS.api;
  const { toast, cerrarModal, rango } = CS.ui;
  const { hoyISO } = CS.util;
  const root = () => document.getElementById('root');
  let token = 0;

  async function render() {
    const mi = ++token;
    const partes = location.hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean);
    const ruta = partes[0] || '';
    try {
      if (!S.user) { S.user = await A().sesion(); if (S.user) await V.cargarBase(); }
      if (!S.user) {
        if (ruta !== 'login') { location.hash = '#/login'; return; }
        root().innerHTML = V.viewLogin(); document.title = 'Iniciar sesión · CampuSpace'; return;
      }
      if (ruta === '' || ruta === 'login') { location.hash = '#/mapa'; return; }
      const soloAdmin = ['solicitudes', 'analitica', 'configuracion'];
      if (soloAdmin.includes(ruta) && !V.esAdmin()) { toast('Sin permiso', 'Esa sección es solo para administradores.', 'err'); location.hash = '#/mapa'; return; }
      root().innerHTML = '<div class="loading">Cargando…</div>';
      let html = '';
      switch (ruta) {
        case 'mapa': html = await V.viewMapa(); break;
        case 'espacios': html = await V.viewEspacios(); break;
        case 'espacio': html = await V.viewFicha(partes[1]); break;
        case 'reservar': html = await V.viewReservar(); break;
        case 'confirmada': html = await V.viewConfirmada(partes[1]); break;
        case 'reservas': html = await V.viewReservas(); break;
        case 'solicitudes': html = await V.viewSolicitudes(); break;
        case 'analitica': html = await V.viewAnalitica(); break;
        case 'configuracion': html = await V.viewConfiguracion(); break;
        default: location.hash = '#/mapa'; return;
      }
      if (mi !== token) return;       // llegó otra navegación mientras cargaba
      root().innerHTML = html;
      document.title = ({ mapa: 'Mapa de disponibilidad', espacios: 'Espacios', espacio: 'Ficha del espacio', reservar: 'Confirmar reserva', confirmada: 'Reserva confirmada', reservas: 'Mis reservas', solicitudes: 'Solicitudes', analitica: 'Analítica', configuracion: 'Configuración' }[ruta] || 'CampuSpace') + ' · CampuSpace';
      if (ruta === 'mapa') V.pintarMapa();
      if (ruta === 'espacios') V.pintarEspacios();
      if (ruta === 'espacio') V.pintarSel();
      if (ruta === 'solicitudes') V.pintarSolicitudes();
      window.scrollTo(0, 0);
    } catch (e) {
      console.error(e);
      root().innerHTML = `<div class="loading"><h2>Algo salió mal</h2><p>${CS.ui.esc(e.message)}</p><p><a href="#/login" data-act="salir">Volver a iniciar sesión</a></p></div>`;
    }
  }
  CS.refrescar = render;

  // ---------- selección de franjas en la ficha ----------
  function clicFranja(h) {
    const id = location.hash.split('/')[2], e = V.espacioPor(id), fecha = S._fichaFecha;
    const st = V.estadoFranja(e, S._fichaRs, fecha, h);
    const av = document.getElementById('aviso-ficha');
    if (st.k === 'ocupado' || st.k === 'pend') {
      V.franjaNoDisponible(h);   // aviso flotante + franja marcada en rojo (mismo mensaje de siempre)
      return;
    }
    if (st.k !== 'libre') return;
    if (av) av.innerHTML = '';
    S._franjaNd = null;
    const max = S.ajustes.duracion_max || 2, s = S.sel && S.sel.espacioId === id && S.sel.fecha === fecha ? S.sel : null;
    if (s && h === s.hasta && (s.hasta + 1 - s.desde) <= max) s.hasta++;
    else if (s && h === s.desde - 1 && (s.hasta - h) <= max) s.desde = h;
    else S.sel = { espacioId: id, fecha, desde: h, hasta: h + 1 };
    document.getElementById('slots').innerHTML = V.panelFranjas(e, S._fichaRs, fecha);
    V.pintarSel();
  }

  let animacion = null;
  const acciones = {
    'salir': async () => { await A().logout(); S.user = null; S.sel = null; location.hash = '#/login'; render(); },
    'olvido': () => toast('Restablecer contraseña', 'Escribe a soporte de tu facultad para que restablezcan tu clave institucional.'),
    'usar-cuenta': (el) => { document.getElementById('email').value = el.dataset.email; document.getElementById('pass').value = el.dataset.pass; },
    'ir-espacio': (el) => { if (S.sel && S.sel.espacioId !== el.dataset.id) S.sel = null; S.avisoFicha = null; location.hash = '#/espacio/' + el.dataset.id; },
    'volver-espacios': () => { location.hash = '#/espacios'; },
    'franja': (el) => clicFranja(+el.dataset.h),
    'cerrar-aviso': (el) => { const a = el.closest('.aviso'); if (a) a.remove(); },
    'ir-reservar': () => { if (S.sel) location.hash = '#/reservar'; },
    'volver-ficha': () => { location.hash = S.sel ? '#/espacio/' + S.sel.espacioId : '#/espacios'; },
    'ver-dia': (el) => {
      if (animacion) { clearInterval(animacion); animacion = null; el.textContent = '▶ Ver el día'; return; }
      let h = CS.HORA_MIN; el.textContent = '❚❚ Detener';
      const paso = () => { S.f.hora = h; const r = document.getElementById('hora'); if (r) r.value = h; V.pintarMapa(); if (h >= CS.HORA_MAX - 1 || !document.getElementById('hora')) { clearInterval(animacion); animacion = null; if (el.isConnected) el.textContent = '▶ Ver el día'; } h++; };
      paso(); animacion = setInterval(paso, 700);
    },
    'recordatorio': async (el) => { const r = await A().reserva(el.dataset.id); V.descargarIcs(r, V.espacioPor(r.espacio_id)); toast('Recordatorio agregado', 'Descargamos un evento para tu calendario.'); },
    'tab-res': (el) => { S.tabRes = el.dataset.t; render(); },
    'tab-sol': (el) => { S.tabSol = el.dataset.t; V.pintarSolicitudes(); },
    'confirmar-llegada': (el) => V.confirmarLlegada(el.dataset.id),
    'pedir-cancelar': (el) => V.pedirCancelar(el.dataset.id),
    'cancelar': (el) => V.cancelar(el.dataset.id),
    'cerrar-modal': () => cerrarModal(),
    'reprogramar': (el) => A().reserva(el.dataset.id).then(r => { S.reprogramar = r.id; S.sel = null; S.avisoFicha = null; location.hash = '#/espacio/' + r.espacio_id; }),
    'aprobar': (el) => V.aprobar(el.dataset.id),
    'abrir-rechazo': (el) => { S.rechazando = el.dataset.id; V.pintarSolicitudes(); },
    'cerrar-rechazo': () => { S.rechazando = null; V.pintarSolicitudes(); },
    'confirmar-rechazo': (el) => V.confirmarRechazo(el.dataset.id),
    'guardar-config': () => V.guardarConfig(),
    // Configuración: muestra u oculta los espacios a partir del sexto
    'ver-todos-esp': (el) => { const t = document.getElementById('cfg-mas'); if (!t) return; const abrir = t.hidden; t.hidden = !abrir; el.setAttribute('aria-expanded', abrir); el.textContent = abrir ? 'Ver menos ↑' : 'Ver los ' + el.dataset.n + ' espacios →'; }
  };

  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const f = acciones[el.dataset.act];
    if (f) { if (el.tagName === 'A' && el.getAttribute('href') === '#/login') ev.preventDefault(); f(el, ev); }
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') cerrarModal(); });
  document.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (ev.target.id === 'form-login') V.enviarLogin();
    if (ev.target.id === 'form-reserva') V.enviarReserva();
  });
  document.addEventListener('input', (ev) => {
    const id = ev.target.id;
    if (id === 'f-q') { S.f.q = ev.target.value; V.pintarMapa(); V.pintarEspacios(); }
    else if (id === 'hora') { S.f.hora = +ev.target.value; V.pintarMapa(); }
    else if (id === 's-q') { S.qSol = ev.target.value; V.pintarSolicitudes(); }
  });
  document.addEventListener('change', (ev) => {
    const id = ev.target.id, v = ev.target.value;
    if (id === 'f-fecha') { S.f.fecha = v; render(); }
    else if (id === 'f-estado') { S.f.estado = v; V.pintarMapa(); V.pintarEspacios(); }
    else if (id === 'f-tipo') { S.f.tipo = v; V.pintarMapa(); V.pintarEspacios(); }
    else if (id === 'ficha-fecha') { S.f.fecha = v; S.sel = null; render(); }
    else if (id === 's-v') { S.ventanaSol = v; V.pintarSolicitudes(); }
    else if (id === 'a-per') { S.periodo = v; render(); }
    else if (id === 'a-esp') { S.espacioAn = v; render(); }
    else if (id === 'r-motivo') { const o = document.getElementById('r-motivo-otro'); if (o) { o.hidden = v !== 'Otro'; if (v === 'Otro') o.focus(); } }
  });
  window.addEventListener('hashchange', () => { if (animacion) { clearInterval(animacion); animacion = null; } cerrarModal(); render(); });
  window.addEventListener('DOMContentLoaded', render);
})();
