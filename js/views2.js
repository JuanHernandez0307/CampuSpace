// Pantallas 2: mis reservas, solicitudes (admin), analítica (admin) y configuración (admin)
(function () {
  const A = () => CS.api;
  const S = CS.S, V = CS.views;
  const { esc, fmtH, h12, rango, etiquetaFecha, horaReloj, iniciales, hace, toast, modal, cerrarModal, nombreEstado, icono } = CS.ui;
  const { hoyISO, sumarDias, horaActual, pad } = CS.util;
  const { shell, cabecera, espacioPor } = V;

  const finalizada = r => r.fecha < hoyISO() || (r.fecha === hoyISO() && r.hora_fin <= horaActual());
  const limiteLlegada = r => { const lib = S.ajustes.liberar_min || 15; return h12(r.hora_inicio) + ':' + pad(lib % 60) + ' ' + (r.hora_inicio >= 12 ? 'pm' : 'am'); };
  const puedeConfirmar = r => {
    if (r.estado !== 'confirmada' || r.llegada_confirmada) return false;
    if (CS_CONFIG.DEMO_CONFIRMAR_LLEGADA_SIEMPRE) return r.fecha >= hoyISO();
    if (r.fecha !== hoyISO()) return false;
    const a = horaActual(), lib = (S.ajustes.liberar_min || 15) / 60;
    return a >= r.hora_inicio - 1 && a <= r.hora_inicio + lib;
  };

  // Libera reservas sin llegada, cierra las que ya pasaron
  async function liberarVencidas(mias) {
    const lib = S.ajustes.liberar_min || 15, hoy = hoyISO(), a = horaActual();
    for (const r of mias) {
      try {
        if (r.estado === 'confirmada' && !r.llegada_confirmada && (r.fecha < hoy || (r.fecha === hoy && a > r.hora_inicio + lib / 60))) {
          const nota = 'Se liberó a las ' + h12(r.hora_inicio) + ':' + pad(lib % 60) + ' ' + (r.hora_inicio >= 12 ? 'pm' : 'am');
          Object.assign(r, await A().actualizarReserva(r.id, { estado: 'no_asistio', nota_estado: nota }));
        } else if (r.estado === 'confirmada' && r.llegada_confirmada && finalizada(r)) {
          Object.assign(r, await A().actualizarReserva(r.id, { estado: 'asistio' }));
        } else if (r.estado === 'pendiente' && finalizada(r)) {
          Object.assign(r, await A().actualizarReserva(r.id, { estado: 'cancelada', nota_estado: 'Nadie respondió a tiempo' }));
        }
      } catch (e) { /* si falla una, seguimos */ }
    }
  }

  // ---------- MIS RESERVAS ----------
  const pillRes = r => {
    if (r.estado === 'pendiente') return '<span class="pill-dash pend">Pendiente de aprobación</span>';
    const k = { confirmada: 's-ok', asistio: 's-ok', no_asistio: 's-no', cancelada: 's-no', rechazada: 's-rech' }[r.estado] || 's-no';
    return `<span class="pill-s ${k}">${esc(nombreEstado[r.estado] || r.estado)}</span>`;
  };
  const detalleRes = r => (r.estado === 'rechazada' && r.motivo_rechazo) ? r.motivo_rechazo : (r.nota_estado || '');
  const accionesRes = r => {
    if (r.estado === 'confirmada' && !r.llegada_confirmada) {
      const hoy = r.fecha === hoyISO(), puede = puedeConfirmar(r);
      return (hoy ? `<button type="button" class="btn sm primary" data-act="confirmar-llegada" data-id="${r.id}" ${puede ? '' : 'disabled'} title="${puede ? '' : 'Disponible desde 1 hora antes hasta ' + limiteLlegada(r)}">Confirmar llegada</button>` : '')
        + `<button type="button" class="btn sm outline" data-act="reprogramar" data-id="${r.id}">Reprogramar</button>`
        + `<button type="button" class="btn sm danger" data-act="pedir-cancelar" data-id="${r.id}">Cancelar</button>`;
    }
    if (r.estado === 'confirmada') return `<span class="tag-ok">✓ Llegada confirmada</span><button type="button" class="btn sm danger" data-act="pedir-cancelar" data-id="${r.id}">Cancelar</button>`;
    return `<button type="button" class="btn sm danger" data-act="pedir-cancelar" data-id="${r.id}">Cancelar</button>`;
  };
  // tipo 'prox': con acciones; tipo 'hist': historial con el detalle del estado
  const filaReserva = (r, tipo) => {
    const e = espacioPor(r.espacio_id) || { nombre: '—' };
    const base = `<td><b>${esc(e.nombre)}</b>`;
    const fh = `<td>${esc(etiquetaFecha(r.fecha))}</td><td>${rango(r.hora_inicio, r.hora_fin)}</td>`;
    if (tipo === 'hist') return `<tr>${base}</td>${fh}<td>${pillRes(r)}</td><td class="nota">${esc(detalleRes(r))}</td></tr>`;
    const hoy = r.fecha === hoyISO(), espera = r.estado === 'confirmada' && !r.llegada_confirmada;
    const sub = hoy && espera ? `<div class="nota">Confirma antes de las ${limiteLlegada(r)}</div>` : (r.estado === 'confirmada' && r.llegada_confirmada && r.nota_estado ? `<div class="nota ok">${esc(r.nota_estado)}</div>` : '');
    const destaca = hoy && r.estado === 'confirmada' && (puedeConfirmar(r) || r.llegada_confirmada);
    return `<tr${destaca ? ' class="hl"' : ''}>${base}${sub}</td>${fh}<td>${pillRes(r)}</td><td><div class="acts">${accionesRes(r)}</div></td></tr>`;
  };
  const tabla = (filas, tipo) => filas.length
    ? `<div class="card rt-card"><table class="rt"><thead><tr><th>Espacio</th><th>Fecha</th><th>Hora</th><th>Estado</th><th>${tipo === 'hist' ? 'Detalle' : 'Acciones'}</th></tr></thead><tbody>${filas.map(r => filaReserva(r, tipo)).join('')}</tbody></table></div>`
    : '<div class="card vacio">No hay reservas en esta pestaña.</div>';

  async function viewReservas() {
    const mias = await A().misReservas(S.user);
    await liberarVencidas(mias);
    const ord = (a, b) => (a.fecha + pad(a.hora_inicio)).localeCompare(b.fecha + pad(b.hora_inicio));
    const prox = mias.filter(r => ['pendiente', 'confirmada'].includes(r.estado) && !finalizada(r)).sort(ord);
    const pas = mias.filter(r => ['asistio', 'no_asistio'].includes(r.estado)).sort((a, b) => ord(b, a));
    const can = mias.filter(r => ['cancelada', 'rechazada'].includes(r.estado)).sort((a, b) => ord(b, a));
    const t = S.tabRes;
    const lista = t === 'proximas' ? prox : t === 'pasadas' ? pas : can;
    const tab = (k, txt) => `<button type="button" class="tab ${t === k ? 'on' : ''}" data-act="tab-res" data-t="${k}" role="tab" aria-selected="${t === k}">${txt}</button>`;
    return shell('reservas', `
      ${cabecera('Campus UCC', 'Mis reservas', 'Revisa, confirma o cancela tus reservas.', `<a class="btn primary btn-lg" href="#/espacios">Nueva reserva</a><span class="upd"><i></i>Actualizado ${horaReloj()}</span>`)}
      <div class="tabs u" role="tablist">${tab('proximas', `Próximas (${prox.length})`)}${tab('pasadas', 'Pasadas')}${tab('canceladas', 'Canceladas')}</div>
      ${tabla(lista, t === 'proximas' ? 'prox' : 'hist')}
      ${t === 'proximas' ? `<div class="res-bajo"><div class="res-ilus"><img src="img/ilustraciones/mis-reservas.png" width="1024" height="1024" alt=""></div>${pas.length ? `<div class="res-hist"><div class="mono-l gris">Historial reciente</div>${tabla(pas.slice(0, 3), 'hist')}</div>` : ''}</div>` : ''}`);
  }
  async function confirmarLlegada(id) {
    try {
      const r = await A().actualizarReserva(id, { llegada_confirmada: true, nota_estado: 'Llegada confirmada a las ' + horaReloj() });
      const e = espacioPor(r.espacio_id);
      toast('Llegada confirmada', e.nombre + ' · ' + CS.ui.rangoLargo(r.hora_inicio, r.hora_fin) + '. Tu reserva está activa.');
      CS.refrescar();
    } catch (e) { toast('No se pudo confirmar', e.message, 'err'); }
  }
  async function pedirCancelar(id) {
    const r = await A().reserva(id); if (!r) return;
    const e = espacioPor(r.espacio_id);
    modal(`<div class="m-ico" aria-hidden="true">!</div><h3>¿Cancelar esta reserva?</h3><p>Si la cancelas, el espacio quedará disponible para otras personas. Esta acción no se puede deshacer.</p><div class="m-res">${esc(e.nombre)} · ${esc(etiquetaFecha(r.fecha))} · ${rango(r.hora_inicio, r.hora_fin)}</div><div class="acts row"><button type="button" class="btn outline" data-act="cerrar-modal" data-foco>Volver</button><button type="button" class="btn danger-solid" data-act="cancelar" data-id="${id}">Sí, cancelar</button></div>`);
  }
  async function cancelar(id) {
    try { await A().actualizarReserva(id, { estado: 'cancelada', nota_estado: 'Cancelada por el usuario' }); cerrarModal(); toast('Reserva cancelada', 'El espacio quedó disponible para otras personas.'); CS.refrescar(); }
    catch (e) { toast('No se pudo cancelar', e.message, 'err'); }
  }

  // ---------- SOLICITUDES (administrador) ----------
  const enVentana = r => {
    const hoy = hoyISO();
    if (S.ventanaSol === 'hoy') return r.fecha === hoy;
    if (S.ventanaSol === 'semana') return r.fecha >= sumarDias(hoy, -7) && r.fecha <= sumarDias(hoy, 7);
    return true;
  };
  function listaSolicitudes() {
    const q = S.qSol.trim().toLowerCase();
    const base = S._todas.filter(r => r.necesita_aprobacion || r.estado === 'rechazada').filter(enVentana).filter(r => {
      const e = espacioPor(r.espacio_id); return !q || ((r.solicitante || '') + ' ' + (e ? e.nombre : '')).toLowerCase().includes(q);
    });
    const por = {
      pendiente: base.filter(r => r.estado === 'pendiente'),
      aprobada: base.filter(r => r.necesita_aprobacion && ['confirmada', 'asistio', 'no_asistio'].includes(r.estado)),
      rechazada: base.filter(r => r.estado === 'rechazada'), todas: base
    };
    return por;
  }
  function pintarSolicitudes() {
    const cont = document.getElementById('lista-sol'); if (!cont) return;
    const por = listaSolicitudes(), t = S.tabSol;
    ['pendiente', 'aprobada', 'rechazada', 'todas'].forEach(k => { const el = document.querySelector(`[data-tabsol="${k}"]`); if (el) { el.classList.toggle('on', k === t); el.setAttribute('aria-selected', k === t); el.querySelector('i').textContent = por[k].length; } });
    const filas = por[t].sort((a, b) => (a.fecha + pad(a.hora_inicio)).localeCompare(b.fecha + pad(b.hora_inicio)));
    cont.innerHTML = filas.length ? filas.map(r => {
      const e = espacioPor(r.espacio_id) || { nombre: '—' };
      const abierta = r.estado === 'pendiente' && S.rechazando === r.id;
      const acc = r.estado === 'pendiente'
        ? `<button type="button" class="btn danger sm" data-act="abrir-rechazo" data-id="${r.id}">Rechazar</button><button type="button" class="btn primary sm" data-act="aprobar" data-id="${r.id}">Aprobar</button>`
        : `<span class="pill-s ${r.estado === 'rechazada' ? 's-rech' : 's-ok'}">${r.estado === 'rechazada' ? 'Rechazada' : 'Aprobada'}</span>`;
      const form = `<div class="rech-form"><label class="f" for="mot-${r.id}">Motivo del rechazo</label><textarea class="in" id="mot-${r.id}" placeholder="Explica por qué no se aprueba"></textarea><div class="msg-err" id="emot-${r.id}" hidden>Escribe el motivo para avisar a la persona.</div><div class="acts"><button type="button" class="btn outline sm" data-act="cerrar-rechazo">Volver</button><button type="button" class="btn danger-solid sm" data-act="confirmar-rechazo" data-id="${r.id}">Confirmar rechazo</button></div></div>`;
      const icoK = r.estado === 'pendiente' ? ['reloj', 'p'] : r.estado === 'rechazada' ? ['solicitudes-rechazadas', 'r'] : ['solicitudes-aprobadas', 'a'];
      return `<article class="sol${abierta ? ' abierta' : ''}">
        <div class="av" aria-hidden="true">${esc(iniciales(r.solicitante || '?'))}</div>
        <div class="cuerpo"><b>${esc(e.nombre)} · ${esc(etiquetaFecha(r.fecha))}, ${rango(r.hora_inicio, r.hora_fin)}</b><div class="m">${esc(r.solicitante)} · ${esc(r.programa || '')} · ${r.asistentes} asistentes</div><div class="mot">Motivo: <b>${esc(r.motivo || '')}</b></div>${r.estado === 'rechazada' && r.motivo_rechazo ? `<div class="m">Rechazo: ${esc(r.motivo_rechazo)}</div>` : ''}</div>
        <div class="hace">${esc(hace(r.creada))}</div>
        <div class="sol-acc">${abierta ? form : acc}</div>
        ${abierta ? '' : `<span class="sol-ico i-${icoK[1]}" aria-hidden="true">${icono(icoK[0])}</span>`}
      </article>`;
    }).join('') : '<div class="card vacio">No hay solicitudes en esta pestaña.</div>';
    if (S.rechazando) { const ta = document.getElementById('mot-' + S.rechazando); if (ta) ta.focus(); }
  }
  async function viewSolicitudes() {
    S._todas = await A().todasReservas();
    const por = listaSolicitudes();
    const sem = S._todas.filter(r => r.necesita_aprobacion && ['confirmada', 'asistio', 'no_asistio'].includes(r.estado) && Date.now() - new Date(r.creada).getTime() < 7 * 864e5 && r.solicitante !== 'Reserva de ejemplo').length;
    const rech = S._todas.filter(r => r.estado === 'rechazada').length;
    const kp = (c, ic, l, n) => `<div class="kp"><span class="kp-ico ${c}" aria-hidden="true">${icono(ic)}</span><div class="kp-t"><span class="l">${l}</span><b class="n ${c}">${n}</b></div></div>`;
    return shell('solicitudes', `
      ${cabecera('Campus UCC', 'Solicitudes', 'Revisa las reservas de espacios que requieren aprobación.')}
      <div class="kp-row">${kp('k1', 'reloj', 'Pendientes', por.pendiente.length)}${kp('k2', 'solicitudes-aprobadas', 'Aprobadas esta semana', sem)}${kp('k3', 'solicitudes-rechazadas', 'Rechazadas', rech)}</div>
      <div class="sol-bar">
        <div class="tabs u" role="tablist">${[['pendiente', 'Pendientes'], ['aprobada', 'Aprobadas'], ['rechazada', 'Rechazadas'], ['todas', 'Todas']].map(([k, t]) => `<button type="button" class="tab ${S.tabSol === k ? 'on' : ''}" data-act="tab-sol" data-t="${k}" data-tabsol="${k}" role="tab" aria-selected="${S.tabSol === k}">${t} (<i>${por[k].length}</i>)</button>`).join('')}</div>
        <div class="sol-filt">
          <div><label class="lf" for="s-q">Búsqueda</label><input class="in" id="s-q" placeholder="solicitante o espacio" value="${esc(S.qSol)}"></div>
          <div><label class="lf" for="s-v">Fecha</label><select class="sel" id="s-v">${[['semana', 'Esta semana'], ['hoy', 'Hoy'], ['todas', 'Todas']].map(([v, t]) => `<option value="${v}"${S.ventanaSol === v ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
        </div>
      </div>
      <div id="lista-sol"></div>
      <img class="sol-ilus" src="img/ilustraciones/solicitudes.png" width="1466" height="313" alt="">`);
  }
  async function aprobar(id) {
    try {
      const r = await A().actualizarReserva(id, { estado: 'confirmada' }); const e = espacioPor(r.espacio_id);
      toast('Solicitud aprobada', e.nombre + ' · ' + etiquetaFecha(r.fecha) + ', ' + CS.ui.rangoLargo(r.hora_inicio, r.hora_fin) + '. Le avisamos a ' + r.solicitante + '.');
      CS.refrescar();
    } catch (e) { toast('No se pudo aprobar', e.message, 'err'); }
  }
  async function confirmarRechazo(id) {
    const t = document.getElementById('mot-' + id);
    if (!t.value.trim()) { document.getElementById('emot-' + id).hidden = false; t.classList.add('err'); return; }
    try {
      const r = await A().actualizarReserva(id, { estado: 'rechazada', motivo_rechazo: t.value.trim() });
      S.rechazando = null; toast('Solicitud rechazada', 'Le avisamos a ' + r.solicitante + ' el motivo.'); CS.refrescar();
    } catch (e) { toast('No se pudo rechazar', e.message, 'err'); }
  }

  // ---------- ANALÍTICA (administrador) ----------
  async function viewAnalitica() {
    const todas = await A().todasReservas();
    const hoy = hoyISO(), a = horaActual(), N = S.periodo === 'semana' ? 7 : 30, desde = sumarDias(hoy, -(N - 1));
    const efectivo = r => (r.estado === 'confirmada' && finalizada(r)) ? (r.llegada_confirmada ? 'asistio' : 'no_asistio') : r.estado;
    const activos = S.espacios.filter(e => e.estado === 'activo' && (!S.espacioAn || e.id === S.espacioAn));
    const rs = todas.filter(r => r.fecha >= desde && r.fecha <= hoy && (!S.espacioAn || r.espacio_id === S.espacioAn) && ['asistio', 'no_asistio'].includes(efectivo(r)));
    const horasTot = Math.max(1, activos.length) * 12 * N;
    const horasOcup = rs.reduce((s, r) => s + (r.hora_fin - r.hora_inicio), 0);
    const ocup = Math.round(100 * horasOcup / horasTot);
    const noAs = rs.filter(r => efectivo(r) === 'no_asistio').length;
    const inasist = rs.length ? Math.round(100 * noAs / rs.length) : 0;
    const porHora = {}; rs.forEach(r => { for (let h = r.hora_inicio; h < r.hora_fin; h++) porHora[h] = (porHora[h] || 0) + 1; });
    let pico = null; Object.entries(porHora).forEach(([h, n]) => { if (!pico || n > pico.n) pico = { h: +h, n }; });
    const porEsp = {}; rs.forEach(r => { porEsp[r.espacio_id] = (porEsp[r.espacio_id] || 0) + (r.hora_fin - r.hora_inicio); });
    // Nombre corto para las barras: "Laboratorio de física" → "Física", "Sala de sistemas 2" → "Sistemas 2"
    const nombreCorto = e => { const n = e.nombre.replace(/^(Laboratorio|Sala|Cámara) de /i, ''); return n.charAt(0).toUpperCase() + n.slice(1); };
    const barras = S.espacios.map(e => ({ e, p: Math.round(100 * (porEsp[e.id] || 0) / (12 * N)) })).sort((x, y) => y.p - x.p).slice(0, 6);
    const maxEsp = barras[0] ? barras[0].e : null;
    // calor: día de la semana × hora
    const horasCalor = [8, 9, 10, 11, 12, 14, 15, 16], dias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];
    const cal = dias.map(() => horasCalor.map(() => 0)); let maxC = 1;
    const calEsp = dias.map(() => horasCalor.map(() => ({})));
    rs.forEach(r => { const d = (new Date(r.fecha + 'T12:00:00').getDay() + 6) % 7; if (d > 4) return; horasCalor.forEach((h, i) => { if (r.hora_inicio <= h && h < r.hora_fin) { cal[d][i]++; calEsp[d][i][r.espacio_id] = (calEsp[d][i][r.espacio_id] || 0) + 1; maxC = Math.max(maxC, cal[d][i]); } }); });
    // línea: reservas vs llegadas últimos 14 días
    const dias14 = Array.from({ length: 14 }, (_, i) => sumarDias(hoy, i - 13));
    const sR = dias14.map(f => rs.filter(r => r.fecha === f).length), sL = dias14.map(f => rs.filter(r => r.fecha === f && efectivo(r) === 'asistio').length);
    const mx = Math.max(1, ...sR), W = 640, H = 190, px = i => 30 + i * ((W - 50) / 13), py = v => H - 20 - (v / mx) * (H - 40);
    const linea = s => s.map((v, i) => (i ? 'L' : 'M') + px(i).toFixed(1) + ' ' + py(v).toFixed(1)).join(' ');
    // hallazgos
    let ventana = null; for (let h = 7; h < 18; h++) { const n = (porHora[h] || 0) + (porHora[h + 1] || 0); if (!ventana || n > ventana.n) ventana = { h, n }; }
    const noAsPorEsp = {}; rs.filter(r => efectivo(r) === 'no_asistio').forEach(r => { noAsPorEsp[r.espacio_id] = (noAsPorEsp[r.espacio_id] || 0) + 1; });
    const peorId = Object.entries(noAsPorEsp).sort((x, y) => y[1] - x[1])[0];
    const enVent = {}; rs.forEach(r => { if (ventana && r.hora_inicio < ventana.h + 2 && ventana.h < r.hora_fin) enVent[r.espacio_id] = (enVent[r.espacio_id] || 0) + 1; });
    const topVent = Object.entries(enVent).sort((x, y) => y[1] - x[1])[0];
    const hall = [];
    if (topVent && ventana) hall.push(`${(espacioPor(topVent[0]) || {}).nombre} se llena de ${h12(ventana.h)} a ${h12(ventana.h + 2)} ${ventana.h + 2 >= 12 ? 'pm' : 'am'}: conviene habilitar otra sala en esa franja.`);
    if (peorId) hall.push(`${(espacioPor(peorId[0]) || {}).nombre} tiene más reservas sin llegada confirmada: enviar recordatorios previos.`);
    if (!hall.length) hall.push('Aún no hay suficientes datos para este periodo.');
    const minC = Math.min(...cal.flat());
    // escala del mapa de calor: claro (pocas reservas) → teal → azul marino (muchas)
    const mezcla = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
    const ESCALA = [[228, 234, 238], [26, 163, 189], [15, 76, 99]];
    const COLORES_BARRA = ['#0f4c63', '#1aa3bd', '#9fd8e3', '#8fe3b0', '#fbe58a', '#c8cfdd'];
    // cada cuadrito toma el color del espacio con más reservas en ese día y hora (el mismo de su barra); la intensidad indica cuántas reservas hay
    const colorEsp = {}; barras.forEach(({ e }, i) => { colorEsp[e.id] = COLORES_BARRA[i]; });
    const color = (n, ce) => {
      if (!n) return 'rgb(' + ESCALA[0].join(',') + ')';
      const top = Object.entries(ce).sort((x, y) => y[1] - x[1])[0][0];
      const hex = colorEsp[top] || '#c8cfdd', c = [1, 3, 5].map(k => parseInt(hex.slice(k, k + 2), 16));
      const t = (n - minC) / Math.max(1, maxC - minC);
      return 'rgba(' + c.join(',') + ',' + (0.4 + 0.6 * t).toFixed(2) + ')';
    };
    const leyenda = barras.map(({ e }, i) => `<span class="lg"><i style="background:${COLORES_BARRA[i]}"></i>${esc(nombreCorto(e))}</span>`).join('');
    const ak = (cls, ic, l, v, nota) => `<div class="ak"><span class="ak-ico ${cls}" aria-hidden="true">${icono(ic)}</span><div class="ak-t"><span class="l">${l}</span><b class="n">${v}</b></div>${nota ? `<span class="ak-nota">${nota}</span>` : ''}</div>`;
    const horaPico = pico && ventana && ventana.n > 0 ? `${h12(ventana.h)}–${h12(ventana.h + 2)} ${ventana.h + 2 >= 12 ? 'pm' : 'am'}` : '—';
    const yG = [py(0), py(mx / 2), py(mx)];

    return shell('analitica', `
      ${cabecera('Toma de decisiones', 'Analítica', '', `<div class="hf an"><select class="sel" id="a-per" aria-label="Periodo"><option value="mes"${S.periodo === 'mes' ? ' selected' : ''}>Periodo: Este mes</option><option value="semana"${S.periodo === 'semana' ? ' selected' : ''}>Periodo: Esta semana</option></select><select class="sel" id="a-esp" aria-label="Espacio"><option value="">Espacio: Todos</option>${S.espacios.map(e => `<option value="${e.id}"${S.espacioAn === e.id ? ' selected' : ''}>${esc(e.nombre)}</option>`).join('')}</select></div>`)}
      <div class="ak-row">
        ${ak('k1', 'analitica-ocupacion', 'Ocupación promedio', ocup + ' %')}
        ${ak('k2', 'analitica-hora-pico', 'Hora pico', horaPico)}
        ${ak('k3', 'analitica-inasistencia', 'Inasistencia', inasist + ' %', 'Reservas sin llegada confirmada')}
        ${ak('k4', 'analitica-mas-solicitado', 'Más solicitado', maxEsp && barras[0].p > 0 ? esc(maxEsp.nombre) : '—')}
      </div>
      <div class="an-2">
        <section class="card an-card"><h3>Ocupación por espacio</h3><div class="barras2">${barras.map(({ e, p }, i) => `<div class="barra2"><span>${esc(nombreCorto(e))}</span><div class="t" role="img" aria-label="${esc(e.nombre)}: ${p} %"><i style="width:${Math.min(100, p)}%;background:${COLORES_BARRA[i] || '#c8cfdd'}"></i></div><b>${p}%</b></div>`).join('')}</div></section>
        <section class="card an-card"><h3>Horas pico de la semana</h3><div class="heat2"><span></span>${horasCalor.map(h => `<span class="hh">${h12(h)}</span>`).join('')}${dias.map((d, i) => `<span class="hd">${d}</span>${cal[i].map((n, j) => `<span class="hc" title="${d} ${h12(horasCalor[j])}: ${n} reservas" style="background:${color(n, calEsp[i][j])}"></span>`).join('')}`).join('')}</div><div class="heat-lg">${leyenda}</div><p class="m">Color = espacio con más reservas · más intenso = más reservas</p></section>
      </div>
      <section class="card an-linea"><h3>Reservas vs. llegadas confirmadas</h3>
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Reservas y llegadas confirmadas de los últimos 14 días"><g stroke="#dde3e8" stroke-width="1"><path d="M30 ${yG[0]}H${W - 20}M30 ${yG[1]}H${W - 20}M30 ${yG[2]}H${W - 20}"/></g><path d="M30 ${yG[2] - 6}V${yG[0]}H${W - 20}" fill="none" stroke="#9aa5b1" stroke-width="1.5"/><path d="${linea(sR)}" fill="none" stroke="#14304a" stroke-width="2.4" stroke-linejoin="round"/><path d="${linea(sL)}" fill="none" stroke="#1aa3bd" stroke-width="2.2" stroke-dasharray="5 4" stroke-linejoin="round"/><g font-size="7.5" fill="#6b7f87"><text x="4" y="${yG[2] + 3}">${mx}</text><text x="4" y="${yG[0] + 3}">0</text>${[0, 6, 13].map(i => `<text x="${px(i) - 12}" y="${H - 4}">${esc(etiquetaFecha(dias14[i]))}</text>`).join('')}</g></svg>
        <p class="m"><b>Línea continua:</b> reservas · <b>Línea punteada:</b> llegadas confirmadas</p></section>
      <section class="hall2"><h3>Hallazgos</h3><ul>${hall.map(h => `<li>${esc(h)}</li>`).join('')}</ul></section>`);
  }

  // ---------- CONFIGURACIÓN (administrador) ----------
  async function viewConfiguracion() {
    S.espacios = await A().espacios(); S.ajustes = await A().ajustes();
    const a = S.ajustes, VISIBLES = 5;
    const sw = (cls, clase, ok, etq) => `<label class="sw2 ${cls}"><input type="checkbox" class="${clase}" ${ok ? 'checked' : ''} aria-label="${esc(etq)}"><span class="trk"></span><span class="tx"></span></label>`;
    const fila = e => `<tr data-esp="${e.id}"><td><b>${esc(e.nombre)}</b></td><td><input class="in cfg-in c-cap" type="number" min="1" value="${e.capacidad}" aria-label="Capacidad de ${esc(e.nombre)}"></td><td>${sw('ap', 'c-apr', e.requiere_aprobacion, 'Requiere aprobación: ' + e.nombre)}</td><td>${sw('mt', 'c-man', e.estado === 'mantenimiento', 'En mantenimiento: ' + e.nombre)}</td></tr>`;
    const primeros = S.espacios.slice(0, VISIBLES), resto = S.espacios.slice(VISIBLES);
    const regla = (cls, ic, id, etq, val, unidad, min) => `<div class="regla2 ${cls}"><span class="r-ico" aria-hidden="true">${icono(ic)}</span><label class="f" for="${id}">${etq}</label><div class="r-val"><input class="in cfg-in" id="${id}" type="number" min="${min}" value="${val}"><span>${unidad}</span></div></div>`;
    return shell('configuracion', `
      ${cabecera('Ajustes', 'Configuración', '', '<button type="button" class="btn primary btn-lg" data-act="guardar-config">Guardar cambios</button>')}
      <div class="card cfg-card">
        <table class="rt cfg"><thead><tr><th>Espacio</th><th>Capacidad</th><th>Requiere aprobación</th><th>En mantenimiento</th></tr></thead>
          <tbody>${primeros.map(fila).join('')}</tbody>
          ${resto.length ? `<tbody id="cfg-mas" hidden>${resto.map(fila).join('')}</tbody>` : ''}
        </table>
        ${resto.length ? `<button type="button" class="cfg-mas" data-act="ver-todos-esp" data-n="${S.espacios.length}" aria-expanded="false" aria-controls="cfg-mas">Ver los ${S.espacios.length} espacios →</button>` : ''}
      </div>
      <h2 class="cfg-h">Reglas de reserva</h2>
      <div class="reglas2">
        ${regla('r1', 'config-liberar-reserva', 'g-lib', 'Liberar si no se confirma la llegada en', a.liberar_min, 'minutos', 1)}
        ${regla('r2', 'config-duracion-maxima', 'g-dur', 'Duración máxima', a.duracion_max, 'horas', 1)}
        ${regla('r3', 'config-anticipacion', 'g-ant', 'Reservar con anticipación hasta', a.anticipacion_dias, 'días', 1)}
        ${regla('r4', 'config-recordatorio', 'g-rec', 'Recordatorio antes de la reserva', a.recordatorio_min, 'minutos antes', 0)}
      </div>`);
  }
  async function guardarConfig() {
    const nums = { liberar_min: 'g-lib', duracion_max: 'g-dur', anticipacion_dias: 'g-ant', recordatorio_min: 'g-rec' };
    const aj = {}; let ok = true;
    for (const [k, id] of Object.entries(nums)) { const el = document.getElementById(id), v = parseInt(el.value, 10); el.classList.toggle('err', !(v >= (k === 'recordatorio_min' ? 0 : 1))); if (!(v >= (k === 'recordatorio_min' ? 0 : 1))) ok = false; aj[k] = v; }
    const cambios = [];
    document.querySelectorAll('tr[data-esp]').forEach(tr => {
      const cap = tr.querySelector('.c-cap'), v = parseInt(cap.value, 10); cap.classList.toggle('err', !(v >= 1)); if (!(v >= 1)) ok = false;
      cambios.push([tr.dataset.esp, { capacidad: v, requiere_aprobacion: tr.querySelector('.c-apr').checked, estado: tr.querySelector('.c-man').checked ? 'mantenimiento' : 'activo' }]);
    });
    if (!ok) { toast('Revisa los valores', 'Hay campos con números no válidos.', 'err'); return; }
    try {
      await A().guardarAjustes(aj);
      for (const [id, c] of cambios) await A().guardarEspacio(id, c);
      await V.cargarBase();
      toast('Cambios guardados', 'Las reglas se aplican a las reservas nuevas.');
    } catch (e) { toast('No se pudo guardar', e.message, 'err'); }
  }

  Object.assign(CS.views, { viewReservas, confirmarLlegada, pedirCancelar, cancelar, viewSolicitudes, pintarSolicitudes, aprobar, confirmarRechazo, viewAnalitica, viewConfiguracion, guardarConfig });
})();
