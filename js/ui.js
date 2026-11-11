// Utilidades de interfaz de CampuSpace: formato, iconos, avisos y ventanas
(function () {
  const { pad, isoDe, hoyISO, sumarDias } = CS.util;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const h12 = h => (h % 12 === 0 ? 12 : h % 12);
  const fmtH = h => h12(h) + ':00 ' + (h >= 12 && h < 24 ? 'pm' : 'am');
  const rango = (a, b) => h12(a) + '–' + h12(b) + ' ' + (b >= 12 ? 'pm' : 'am');
  const rangoLargo = (a, b) => fmtH(a) + ' – ' + fmtH(b);
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const etiquetaFecha = iso => {
    const hoy = hoyISO();
    if (iso === hoy) return 'Hoy';
    if (iso === sumarDias(hoy, 1)) return 'Mañana';
    if (iso === sumarDias(hoy, -1)) return 'Ayer';
    return cap(new Date(iso + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '').replace(',', ''));
  };
  const fechaLarga = iso => cap(new Date(iso + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }));
  const horaReloj = () => { const d = new Date(); return h12(d.getHours()) + ':' + pad(d.getMinutes()) + ' ' + (d.getHours() >= 12 ? 'pm' : 'am'); };
  const iniciales = n => n.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0].toUpperCase()).join('');
  const hace = iso => {
    const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (m < 60) return 'hace ' + m + ' min';
    if (m < 1440) return 'hace ' + Math.round(m / 60) + ' h';
    const d = Math.round(m / 1440); return d === 1 ? 'ayer' : 'hace ' + d + ' días';
  };
  const opcionesFecha = (sel, dias) => {
    let o = '';
    for (let i = 0; i <= dias; i++) { const f = sumarDias(hoyISO(), i); o += `<option value="${f}"${f === sel ? ' selected' : ''}>${esc(i === 0 ? 'Hoy' : etiquetaFecha(f))}</option>`; }
    return o;
  };

  const ICONOS = {
    mapa: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6zM9 4v14M15 6v14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
    espacios: '<rect x="4" y="4" width="6.500" height="6.500" rx="1" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="13.500" y="4" width="6.500" height="6.500" rx="1" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="4" y="13.500" width="6.500" height="6.500" rx="1" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="13.500" y="13.500" width="6.500" height="6.500" rx="1" fill="none" stroke="currentColor" stroke-width="1.7"/>',
    reservas: '<rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4 10h16M9 3v4M15 3v4" stroke="currentColor" stroke-width="1.7" fill="none"/>',
    solicitudes: '<path d="M3 13l3-8h12l3 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6zM3 13h5l1.500 2.500h6L17 13h4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/>',
    analitica: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    configuracion: '<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.400 15a1.650 1.650 0 0 0 .33 1.820l.06.06a2 2 0 0 1-2.830 2.830l-.06-.06a1.650 1.650 0 0 0-1.820-.33 1.650 1.650 0 0 0-1 1.510V21a2 2 0 0 1-4 0v-.09A1.650 1.650 0 0 0 9 19.400a1.650 1.650 0 0 0-1.820.33l-.06.06a2 2 0 0 1-2.830-2.830l.06-.06a1.650 1.650 0 0 0 .33-1.820 1.650 1.650 0 0 0-1.510-1H3a2 2 0 0 1 0-4h.09A1.650 1.650 0 0 0 4.600 9a1.650 1.650 0 0 0-.33-1.820l-.06-.06a2 2 0 0 1 2.830-2.830l.06.06a1.650 1.650 0 0 0 1.820.33H9a1.650 1.650 0 0 0 1-1.510V3a2 2 0 0 1 4 0v.09a1.650 1.650 0 0 0 1 1.510 1.650 1.650 0 0 0 1.820-.33l.06-.06a2 2 0 0 1 2.830 2.830l-.06.06a1.650 1.650 0 0 0-.33 1.820V9a1.650 1.650 0 0 0 1.510 1H21a2 2 0 0 1 0 4h-.09a1.650 1.650 0 0 0-1.510 1z"/></g>',
    salir: '<path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    televisor: '<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7.500" width="18" height="12" rx="2"/><path d="M8 3.500l4 4 4-4"/></g>',
    edificio: '<path d="M4 21V7l8-4 8 4v14M8 21v-5h8v5M8 10h2M14 10h2M8 13h2M14 13h2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>'
  };
  // Los íconos del menú vienen del set oficial (js/icons.js, generado desde img/iconos); 'edificio' queda como respaldo.
  const ALIAS = { mapa: 'menu-mapa', espacios: 'menu-espacios', reservas: 'menu-reservas', solicitudes: 'menu-solicitudes', analitica: 'menu-analitica', configuracion: 'menu-configuracion', salir: 'menu-cerrar-sesion' };
  const icono = k => {
    const s = (CS.ICONOS_SVG || {})[ALIAS[k] || k];
    return s ? `<svg viewBox="${s.vb}" aria-hidden="true" focusable="false">${s.b}</svg>` : `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONOS[k] || ''}</svg>`;
  };
  const logo = `<span class="brand-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="M12 2.5c-4.100 0-7.300 3.100-7.300 7 0 5 7.300 12 7.300 12s7.300-7 7.300-12c0-3.900-3.200-7-7.300-7z"/><rect x="7.800" y="6.200" width="5" height="5" rx=".6"/><path d="M12.800 9.300l2.700 2.700-3.300 3.300-2.700-2.700"/></svg></span>`;

  // ---------- Avisos (toast) y ventanas (modal) ----------
  // Aviso flotante: verde (éxito) o rojo (error), con ícono y botón para cerrarlo
  function toast(titulo, texto, tipo) {
    let c = document.getElementById('toasts');
    if (!c) { c = document.createElement('div'); c.id = 'toasts'; c.className = 'toasts'; c.setAttribute('role', 'status'); document.body.appendChild(c); }
    const err = tipo === 'err', t = document.createElement('div');
    t.className = 'toast' + (err ? ' err' : '');
    if (err) t.setAttribute('role', 'alert');
    t.innerHTML = `<span class="t-ico" aria-hidden="true">${err ? '!' : '<svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'}</span><div class="t-body"><b>${esc(titulo)}</b>${texto ? `<span>${esc(texto)}</span>` : ''}</div><button type="button" class="t-x" aria-label="Cerrar aviso">×</button>`;
    t.querySelector('.t-x').addEventListener('click', () => t.remove());
    c.appendChild(t);
    setTimeout(() => t.remove(), err ? 7000 : 5200);
  }
  function modal(html) {
    cerrarModal();
    const o = document.createElement('div');
    o.className = 'overlay'; o.id = 'modal'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true');
    o.innerHTML = `<div class="modal">${html}</div>`;
    const h = o.querySelector('h3'); if (h) { h.id = 'modal-titulo'; o.setAttribute('aria-labelledby', 'modal-titulo'); }
    document.body.appendChild(o);
    const b = o.querySelector('[data-foco]'); if (b) b.focus();
  }
  function cerrarModal() { const m = document.getElementById('modal'); if (m) m.remove(); }

  // ---------- Estado de un espacio a una hora ----------
  function estadoEn(esp, reservasDia, h) {
    if (esp.estado === 'mantenimiento') return { k: 'mantenimiento', etq: 'En mantenimiento', txt: 'No se puede reservar' };
    const rs = reservasDia.filter(r => r.espacio_id === esp.id).sort((a, b) => a.hora_inicio - b.hora_inicio);
    const en = rs.find(r => r.hora_inicio <= h && h < r.hora_fin);
    if (en) {
      if (en.estado === 'pendiente') return { k: 'pendiente', etq: 'Pendiente de aprobación', txt: 'Hasta las ' + fmtH(en.hora_fin) };
      return { k: 'ocupado', etq: 'Ocupado', txt: 'Se libera a las ' + fmtH(en.hora_fin) };
    }
    const sig = rs.find(r => r.hora_inicio > h);
    if (sig && sig.hora_inicio === h + 1) return { k: 'pronto', etq: 'Reservado pronto', txt: 'Desde las ' + fmtH(sig.hora_inicio) };
    return { k: 'disponible', etq: 'Disponible', txt: sig ? 'Libre hasta las ' + fmtH(sig.hora_inicio) : 'Libre hasta las ' + fmtH(CS.HORA_MAX) };
  }
  const nombreEstado = { pendiente: 'Pendiente de aprobación', confirmada: 'Confirmada', asistio: 'Asistió', no_asistio: 'No asistió', cancelada: 'Cancelada', rechazada: 'Rechazada' };

  CS.ui = { esc, h12, fmtH, rango, rangoLargo, cap, etiquetaFecha, fechaLarga, horaReloj, iniciales, hace, opcionesFecha, icono, logo, toast, modal, cerrarModal, estadoEn, nombreEstado };
})();
