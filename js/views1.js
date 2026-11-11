// Pantallas 1: login, estructura con menú, mapa, espacios, ficha, confirmar reserva y reserva confirmada
(function () {
  const A = () => CS.api;
  const { esc, fmtH, rango, rangoLargo, etiquetaFecha, fechaLarga, horaReloj, opcionesFecha, icono, logo, estadoEn, toast, h12, cap } = CS.ui;
  const { hoyISO, sumarDias, horaActual } = CS.util;

  const S = CS.S = {
    user: null, espacios: [], ajustes: {},
    sel: null,              // { espacioId, fecha, desde, hasta }
    avisoFicha: null,       // aviso de error mostrado en la ficha
    reprogramar: null,      // id de la reserva que se está reprogramando
    f: { q: '', fecha: hoyISO(), estado: '', tipo: '', hora: null },
    tabRes: 'proximas', tabSol: 'pendiente', qSol: '', ventanaSol: 'semana',
    periodo: 'mes', espacioAn: ''
  };
  const fueraDeHorario = () => horaActual() < CS.HORA_MIN || horaActual() >= CS.HORA_MAX - 0.25;
  const horaInicial = () => fueraDeHorario() ? 9 : Math.min(CS.HORA_MAX - 1, Math.floor(horaActual()));
  if (fueraDeHorario() && horaActual() >= CS.HORA_MAX - 0.25) S.f.fecha = sumarDias(hoyISO(), 1);   // de noche se muestra mañana
  S.f.hora = horaInicial();

  const esAdmin = () => S.user && S.user.rol === 'administrador';
  const espacioPor = id => S.espacios.find(e => e.id === id);
  // Foto del espacio: la de la base de datos o img/espacios/<id>.jpg; si no existe, se ve la ilustración de respaldo.
  const urlFoto = e => "url('" + esc(e.imagen || 'img/espacios/' + e.id + '.jpg') + "'),url('img/ilustraciones/ficha.jpg')";
  const foto = (e, cls) => `<div class="foto ${cls || ''}" style="background-image:${urlFoto(e)}" role="img" aria-label="Foto de ${esc(e.nombre)}"></div>`;

  // ---------- estructura con menú lateral ----------
  // Logo de la UCC: si no existe img/ucc-logo.png se muestra el nombre en texto.
  const uccHtml = `<div class="ucc"><img src="img/ucc-logo.png" alt="Universidad Cooperativa de Colombia" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:this.alt}))"></div>`;

  // Menú por rol: estudiante y docente ven mapa, espacios y reservas; el administrador, además, solicitudes, analítica y configuración.
  function shell(activa, contenido) {
    const items = [['mapa', 'Mapa de disponibilidad', 'mapa'], ['espacios', 'Espacios', 'espacios'], ['reservas', 'Reservas', 'reservas']];
    if (esAdmin()) items.push(['solicitudes', 'Solicitudes', 'solicitudes'], ['analitica', 'Analítica', 'analitica'], ['configuracion', 'Configuración', 'configuracion']);
    return `<div class="app">
      <aside class="side">
        <div class="brand">${logo}<span>CampuSpace</span></div>
        <small>MENÚ</small>
        <nav class="nav" aria-label="Menú principal">
          ${items.map(([k, t, ic]) => `<a href="#/${k}" class="${k === activa ? 'on' : ''}"${k === activa ? ' aria-current="page"' : ''}>${icono(ic)}<span>${t}</span></a>`).join('')}
          <button type="button" data-act="salir">${icono('salir')}<span>Cerrar sesión</span></button>
        </nav>
        <div class="usuario push"><b>${esc(S.user.nombre)}</b>${esc(cap(S.user.rol))}${S.user.programa ? ' · ' + esc(S.user.programa) : ''}</div>
      </aside>
      <main class="main">${contenido}
        <div class="foot"><span class="nota">${CS.api.modo === 'demo' ? 'Modo demostración' : ''}</span>${uccHtml}</div>
      </main></div>`;
  }
  const cabecera = (eyebrow, titulo, sub, extra) => `<div class="head"><div><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(titulo)}</h1>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}</div><div class="row">${extra === undefined ? `<span class="upd"><i></i>Actualizado ${horaReloj()}</span>` : extra}</div></div>`;

  // ---------- LOGIN ----------
  function viewLogin() {
    const cuentas = CS.CUENTAS;
    return `<div class="login">
      <section class="login-hero">
        <div class="brand">${logo}<span>CampuSpace</span></div>
        <div class="hero-body">
          <h1>Conectando espacios, facilitando tu día.</h1>
          <p class="hero-p">Explora la disponibilidad de espacios en el campus y reserva tu lugar de manera rápida, responsable y organizada.</p>
          <img class="hero-art" src="img/login-campus.jpg" width="1083" height="520" alt="Ilustración isométrica del campus con sus espacios reservables">
        </div>
        <div class="login-foot">Reserva de espacios · Campus UCC</div>
      </section>
      <section class="login-side">
        <div class="login-col">
          <form class="login-card" id="form-login" novalidate>
            <h2>Iniciar sesión</h2>
            <p class="sub">Ingresa con tu cuenta institucional para consultar y reservar espacios.</p>
            <div class="field"><label class="f" for="email">Correo institucional</label>
              <input class="in" id="email" type="email" autocomplete="username" placeholder="nombre@campusucc.edu.co" aria-describedby="err-email"><div class="msg-err" id="err-email" role="alert" hidden></div></div>
            <div class="field"><label class="f" for="pass">Contraseña</label>
              <input class="in" id="pass" type="password" autocomplete="current-password" placeholder="••••••••" aria-describedby="err-pass"><div class="msg-err" id="err-pass" role="alert" hidden></div></div>
            <div class="field-link"><button type="button" class="btn link" data-act="olvido">¿Olvidaste tu contraseña?</button></div>
            <button class="btn primary" id="btn-login" type="submit">Iniciar sesión</button>
          </form>
          ${CS_CONFIG.MOSTRAR_CUENTAS_DEMO ? `<div class="demo-box"><b>Cuentas de prueba</b><br>${cuentas.map(c => `<button type="button" data-act="usar-cuenta" data-email="${c.email}" data-pass="${c.password}">${esc(cap(c.rol))}</button>`).join('')}<br>Toca una para rellenar el formulario.</div>` : ''}
        </div>
        ${uccHtml}
      </section></div>`;
  }
  async function enviarLogin() {
    const email = document.getElementById('email'), pass = document.getElementById('pass');
    const eE = document.getElementById('err-email'), eP = document.getElementById('err-pass'), btn = document.getElementById('btn-login');
    [eE, eP].forEach(x => { x.hidden = true; }); [email, pass].forEach(x => x.classList.remove('err'));
    if (!pass.value) { eP.textContent = 'Escribe tu contraseña.'; eP.hidden = false; pass.classList.add('err'); }
    btn.disabled = true; btn.textContent = 'Entrando…';
    try {
      if (!pass.value) throw CS.util.errorApp('PASS', '');
      S.user = await A().login(email.value, pass.value);
      await cargarBase();
      location.hash = '#/mapa';
    } catch (e) {
      if (e.codigo === 'CORREO' || e.codigo === 'DOMINIO') { eE.textContent = e.message; eE.hidden = false; email.classList.add('err'); }
      else if (e.codigo !== 'PASS') { eP.textContent = e.codigo === 'CREDENCIALES' ? e.message : 'No pudimos iniciar sesión: ' + e.message; eP.hidden = false; pass.classList.add('err'); }
      btn.disabled = false; btn.textContent = 'Iniciar sesión';
    }
  }
  async function cargarBase() {
    [S.espacios, S.ajustes] = await Promise.all([A().espacios(), A().ajustes()]);
  }

  // ---------- filtros compartidos (mapa y espacios) ----------
  function filtrar(reservasDia) {
    const f = S.f, q = f.q.trim().toLowerCase();
    return S.espacios.map(e => ({ e, st: estadoEn(e, reservasDia, f.hora) })).filter(({ e, st }) =>
      (!q || (e.nombre + ' ' + e.aula + ' ' + e.tipo).toLowerCase().includes(q)) && (!f.tipo || e.tipo === f.tipo) && (!f.estado || st.k === f.estado || (f.estado === 'ocupado' && st.k === 'pendiente')));
  }

  // ---------- MAPA ----------
  // Posición de cada espacio en el plano: [columna, fila]. Todas las fichas miden lo mismo.
  const POS = {
    'lab-fisica': [1, 1], 'auditorio-principal': [1, 2], 'lab-enfermeria': [1, 3],
    'lab-psicologia': [2, 1], 'auditorio-4piso': [2, 2], 'lab-contaduria': [2, 3], 'sala-audiencias': [2, 4],
    'camara-gesell': [3, 1], 'lab-redes': [3, 3], 'sala-sistemas-2': [3, 4]
  };
  const txtCorto = st => st.k === 'mantenimiento' ? 'Hasta nuevo aviso' : st.txt.replace(':00 ', ' ').replace(/^Libre hasta/, 'Hasta').replace(/^Se libera a/, 'Hasta');
  const etqCorta = st => st.k === 'pendiente' ? 'Pendiente' : st.etq;
  const horaMapa = () => (S.f.fecha === hoyISO() && !fueraDeHorario() && S.f.hora === Math.floor(horaActual())) ? horaReloj() : fmtH(S.f.hora);

  async function viewMapa() {
    const [res, todas, mias] = await Promise.all([A().reservasActivas(S.f.fecha), esAdmin() ? A().todasReservas() : Promise.resolve([]), A().misReservas(S.user)]);
    S._resDia = res;
    const pend = todas.filter(r => r.estado === 'pendiente').length;
    const prox = mias.filter(r => ['pendiente', 'confirmada'].includes(r.estado) && r.fecha >= hoyISO()).sort((a, b) => (a.fecha + a.hora_inicio).localeCompare(b.fecha + b.hora_inicio)).slice(0, 3);
    const filtros = `<div class="hf">
        <div><label class="lf" for="f-fecha">Fecha</label><select class="sel" id="f-fecha">${opcionesFecha(S.f.fecha, S.ajustes.anticipacion_dias || 7)}</select></div>
        <div><label class="lf" for="f-tipo">Tipo de espacio</label><select class="sel" id="f-tipo">${['', 'Sala', 'Laboratorio', 'Auditorio'].map(v => `<option value="${v}"${S.f.tipo === v ? ' selected' : ''}>${v || 'Todos'}</option>`).join('')}</select></div>
      </div><span class="upd"><i></i>Actualizado ${horaReloj()}</span>`;
    const min = CS.HORA_MIN, max = CS.HORA_MAX - 1;
    let ticks = '';
    for (let h = 8; h <= max; h += 2) ticks += `<span style="left:${((h - min) / (max - min) * 100).toFixed(2)}%">${(h12(h) < 10 && h < 12 ? '0' : '') + h12(h) + (h >= 12 ? 'pm' : 'am')}</span>`;
    const solicitudes = esAdmin() ? `<section class="card"><h3>Solicitudes pendientes</h3><p class="m">${pend === 0 ? 'No hay solicitudes por revisar.' : pend + (pend === 1 ? ' solicitud espera aprobación.' : ' solicitudes esperan aprobación.')}</p><a class="btn outline" href="#/solicitudes">Revisar</a></section>` : '';
    const proxHtml = prox.length ? prox.map(r => {
      const e = espacioPor(r.espacio_id), hoy = r.fecha === hoyISO();
      const nota = [hoy ? '' : etiquetaFecha(r.fecha), r.estado === 'pendiente' ? 'Pendiente de aprobación' : ''].filter(Boolean).join(' · ');
      return `<div class="prox"><div><b>${esc(e ? e.nombre : '')}</b>${nota ? `<span class="m">${esc(nota)}</span>` : ''}</div><span class="hrs">${fmtH(r.hora_inicio)} / ${fmtH(r.hora_fin)}</span></div>`;
    }).join('') : '<p class="m">Aún no tienes reservas próximas.</p>';
    return shell('mapa', `
      ${cabecera('Campus UCC', 'Disponibilidad de espacios', 'Estado de los espacios en tiempo real según reservas y confirmaciones de llegada.', filtros)}
      <div class="dash">
        <div class="dash-main">
          <div class="kpis" id="kpis"></div>
          <section class="card plano" aria-label="Plano del campus">
            <div class="plano-h"><h3>Plano del campus · <span id="hora-txt">${horaMapa()}</span></h3><span class="m">Toca un espacio para ver su detalle</span></div>
            <div class="mapa" id="mapa"></div>
            <div class="legend"><span><i class="lg-d"></i>Disponible</span><span><i class="lg-p"></i>Reservado pronto</span><span><i class="lg-o"></i>Ocupado</span><span><i class="lg-b"></i>Pendiente</span><span><i class="lg-m"></i>En mantenimiento</span></div>
            <div class="slider">
              <button type="button" class="btn outline sm" data-act="ver-dia">▶ Ver el día</button>
              <div class="slider-c">
                <label class="mono" for="hora">Hora del día · <span id="hora-lbl">${horaMapa()}</span></label>
                <input type="range" id="hora" min="${min}" max="${max}" step="1" value="${S.f.hora}">
                <div class="ticks" aria-hidden="true">${ticks}</div>
              </div>
            </div>
          </section>
        </div>
        <aside class="dash-side">
          <img class="banner" src="img/ilustraciones/mapa.jpg" width="1000" height="494" alt="">
          ${solicitudes}
          <section class="card"><h3>Disponibles ahora</h3><div id="disp-ahora"></div></section>
          <section class="card"><h3>Próximas reservas</h3>${proxHtml}<a class="enlace" href="#/reservas">Ver mis reservas</a></section>
        </aside>
      </div>`);
  }
  function pintarMapa() {
    const m = document.getElementById('mapa'); if (!m) return;
    const hora = S.f.hora, tipo = S.f.tipo;
    const estados = S.espacios.map(e => ({ e, st: estadoEn(e, S._resDia, hora) }));
    m.innerHTML = estados.map(({ e, st }) => {
      const p = POS[e.id], opaco = tipo && e.tipo !== tipo;
      const pos = p ? `--c:${p[0]};--r:${p[1]}` : '--c:auto;--r:auto';
      const r = (st.k === 'ocupado' || st.k === 'pendiente') ? S._resDia.find(x => x.espacio_id === e.id && x.hora_inicio <= hora && hora < x.hora_fin) : null;
      const det = r ? `<span class="det"><b>${esc(e.nombre)} · ${st.k === 'pendiente' ? 'Pendiente' : 'Ocupado'}</b><span>Reservado por ${esc(r.solicitante || 'otra persona')}</span><span>${st.k === 'pendiente' ? 'Hasta las ' : 'Se libera a las '}${fmtH(r.hora_fin)}</span><span class="go">Ver detalle →</span></span>` : '';
      return `<button type="button" class="tile t-${st.k}${opaco ? ' dim' : ''}" style="${pos}" data-act="ir-espacio" data-id="${e.id}"${opaco ? ' disabled' : ''} aria-label="${esc(e.nombre + ', ' + e.aula + '. ' + st.etq + '. ' + st.txt)}"><span class="t-top"><b>${esc(e.nombre)}</b><span>${esc(e.aula)}</span></span><span class="t-bot"><strong>${esc(etqCorta(st))}</strong><small>${esc(txtCorto(st))}</small></span>${det}</button>`;
    }).join('');
    const disp = estados.filter(({ st }) => st.k === 'disponible' || st.k === 'pronto').length, ocup = estados.filter(({ st }) => st.k === 'ocupado' || st.k === 'pendiente').length;
    const k = document.getElementById('kpis');
    if (k) k.innerHTML = `<div class="kpi hl"><span class="l">Disponibles ahora</span><span class="n"><b>${disp}</b> espacios de ${S.espacios.length}</span></div><div class="kpi"><span class="l">Ocupados</span><span class="n"><b>${ocup}</b></span></div><div class="kpi"><span class="l">Reservas de ${S.f.fecha === hoyISO() ? 'hoy' : esc(etiquetaFecha(S.f.fecha).toLowerCase())}</span><span class="n"><b>${S._resDia.length}</b></span></div>`;
    const libres = estados.filter(({ st }) => st.k === 'disponible').slice(0, 2);
    const d = document.getElementById('disp-ahora');
    if (d) d.innerHTML = libres.length ? libres.map(({ e, st }) => `<div class="disp"><div><b>${esc(e.nombre)}</b><span class="m">${esc(st.txt)}</span></div><button type="button" class="btn primary sm" data-act="ir-espacio" data-id="${e.id}" aria-label="Reservar ${esc(e.nombre)}">Reservar</button></div>`).join('') : '<p class="m">No hay espacios disponibles a esta hora.</p>';
    const t = horaMapa();
    ['hora-txt', 'hora-lbl'].forEach(id => { const x = document.getElementById(id); if (x) x.textContent = t; });
    const rg = document.getElementById('hora');
    if (rg) rg.style.setProperty('--p', ((hora - CS.HORA_MIN) / (CS.HORA_MAX - 1 - CS.HORA_MIN) * 100).toFixed(1) + '%');
  }

  // ---------- ESPACIOS ----------
  const etqCard = st => st.k === 'pendiente' ? 'Pendiente' : st.k === 'mantenimiento' ? 'Mantenimiento' : st.k === 'pronto' ? 'Reserva pronto' : st.etq;
  async function viewEspacios() {
    S._resDia = await A().reservasActivas(S.f.fecha);
    const f = S.f;
    const estados = [['', 'Todos'], ['disponible', 'Disponible'], ['pronto', 'Reservado pronto'], ['ocupado', 'Ocupado'], ['mantenimiento', 'En mantenimiento']];
    return shell('espacios', `
      ${cabecera('Campus UCC', 'Espacios', 'Consulta la información de cada espacio y reserva.')}
      <div class="esp-filtros" role="search">
        <span class="f-ico">${icono('buscar')}</span>
        <div><label class="lf" for="f-q">Búsqueda</label><input class="in" id="f-q" placeholder="Buscar espacio" value="${esc(f.q)}"></div>
        <div><label class="lf" for="f-fecha">Fecha</label><select class="sel" id="f-fecha">${opcionesFecha(f.fecha, S.ajustes.anticipacion_dias || 7)}</select></div>
        <div><label class="lf" for="f-estado">Estado</label><select class="sel" id="f-estado">${estados.map(([v, t]) => `<option value="${v}"${f.estado === v ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
        <div><label class="lf" for="f-tipo">Tipo de espacio</label><select class="sel" id="f-tipo">${['', 'Sala', 'Laboratorio', 'Auditorio'].map(v => `<option value="${v}"${f.tipo === v ? ' selected' : ''}>${v || 'Todos'}</option>`).join('')}</select></div>
      </div>
      <section class="card esp-panel" aria-label="Lista de espacios">
        <div class="plano-h"><h3 id="esp-count">Todos los espacios</h3><span class="m">Toca un espacio para ver su detalle</span></div>
        <div class="esp-grid" id="lista-esp"></div>
        <div class="legend"><span><i class="lg-d"></i>Disponible</span><span><i class="lg-p"></i>Reservado pronto</span><span><i class="lg-o"></i>Ocupado</span><span><i class="lg-b"></i>Pendiente</span><span><i class="lg-m"></i>En mantenimiento</span></div>
      </section>`);
  }
  function pintarEspacios() {
    const c = document.getElementById('lista-esp'); if (!c) return;
    const lista = filtrar(S._resDia), f = S.f;
    const hayFiltro = f.q.trim() || f.tipo || f.estado;
    const n = document.getElementById('esp-count');
    if (n) n.textContent = (hayFiltro ? 'Resultados' : 'Todos los espacios') + ' · ' + lista.length + (lista.length === 1 ? ' espacio' : ' espacios');
    c.innerHTML = lista.length ? lista.map(({ e, st }) => {
      const mant = st.k === 'mantenimiento';
      const aula = e.aula && e.aula !== e.nombre ? `<span class="aula">${esc(e.aula)}</span>` : '';
      const aviso = e.requiere_aprobacion ? ' title="Requiere aprobación de un administrador"' : '';
      return `<article class="ecard${mant ? ' mant' : ''}" data-act="ir-espacio" data-id="${e.id}">
        <div class="efoto" style="background-image:${urlFoto(e)}" role="img" aria-label="Foto de ${esc(e.nombre)}"></div>
        <div class="ebody">
          <div class="enom"><b>${esc(e.nombre)}</b>${aula}</div>
          <div class="ebar b-${st.k}"><strong>${esc(etqCard(st))}</strong><small>${esc(txtCorto(st))}</small></div>
          <div class="ecap"><b>Capacidad:</b> ${e.capacidad} personas</div>
          <div class="eacc"><button type="button" class="btn outline sm" data-act="ir-espacio" data-id="${e.id}" aria-label="Ver ficha de ${esc(e.nombre)}">Ver ficha</button>${mant ? '<button type="button" class="btn sm nd" disabled>No disponible</button>' : `<button type="button" class="btn primary sm" data-act="ir-espacio" data-id="${e.id}"${aviso} aria-label="Reservar ${esc(e.nombre)}">Reservar</button>`}</div>
        </div></article>`;
    }).join('') : '<p class="vacio">Ningún espacio coincide con los filtros.</p>';
  }

  // ---------- FICHA ----------
  function estadoFranja(e, rs, fecha, h) {
    if (e.estado === 'mantenimiento') return { k: 'ocupado', t: 'En mantenimiento' };
    if (fecha === hoyISO() && h + (S.ajustes.liberar_min || 15) / 60 <= horaActual()) return { k: 'pasada', t: 'Ya pasó' };
    const r = rs.find(x => x.hora_inicio <= h && h < x.hora_fin);
    if (r) return r.estado === 'pendiente' ? { k: 'pend', t: 'Pendiente de aprobación' } : { k: 'ocupado', t: 'Ocupado' };
    return { k: 'libre', t: 'Libre' };
  }
  function panelFranjas(e, rs, fecha) {
    const sel = S.sel && S.sel.espacioId === e.id && S.sel.fecha === fecha ? S.sel : null;
    const corto = { ocupado: 'Ocupado', pend: 'Pendiente', libre: 'Libre' };
    let html = '', n = 0;
    for (let h = CS.HORA_MIN; h < CS.HORA_MAX; h++) {
      const st = estadoFranja(e, rs, fecha, h);
      if (st.k === 'pasada') continue;               // las franjas que ya pasaron hoy no se muestran
      n++;
      const marcada = sel && h >= sel.desde && h < sel.hasta;
      const nd = !marcada && S._franjaNd === h && (st.k === 'ocupado' || st.k === 'pend');
      const etq = marcada ? 'Elegida' : nd ? 'No disponible' : (e.estado === 'mantenimiento' ? 'Mantenimiento' : (corto[st.k] || st.t));
      html += `<button type="button" class="slot ${marcada ? 'sel' : nd ? 'nd' : st.k}" data-act="franja" data-h="${h}"><span>${rango(h, h + 1)}</span><strong>${etq}</strong></button>`;
    }
    return n ? html : '<p class="m slots-vacio">Ya no quedan franjas disponibles para esta fecha. Elige otro día.</p>';
  }
  // Ícono de cada equipo (set oficial de img/iconos). Se busca por palabra clave en el texto del equipo.
  const EQUIPO_ICONO = [
    ['van de graaff', 'equipo-generador-van-de-graaff'], ['carril', 'equipo-carril-dinamica'], ['circuitos', 'equipo-kit-circuitos-medicion'],
    ['estrado', 'equipo-estrado'], ['atril', 'equipo-estrado'], ['mesas', 'equipo-mesas'], ['mesones', 'equipo-mesas'],
    ['invitados', 'equipo-sillas-invitados'], ['butacas', 'equipo-sillas'], ['sillas', 'equipo-sillas'],
    ['microfono', 'equipo-microfonos'], ['proyector', 'equipo-proyector'], ['pantalla', 'equipo-proyector'], ['televisor', 'televisor'],
    ['microscopio', 'equipo-microscopios'], ['bioseguridad', 'equipo-bioseguridad'], ['muestras', 'equipo-muestras-tubos'], ['anatomic', 'equipo-modelos-anatomicos'],
    ['espejo', 'equipo-espejo-unidireccional'], ['vigilancia', 'equipo-camaras-video'], ['video', 'equipo-camaras-video'], ['observacion', 'equipo-sala-observacion'],
    ['ludico', 'equipo-material-ludico'], ['audio', 'equipo-sistema-audio'], ['sonido', 'equipo-sistema-audio'],
    ['computo', 'equipo-computo'], ['software', 'equipo-software-contable'],
    ['camillas', 'equipo-camillas'], ['simulador', 'equipo-simuladores-clinicos'], ['insumos', 'equipo-insumos-medicos'], ['lavamanos', 'equipo-lavamanos'],
    ['routers', 'equipo-routers'], ['switches', 'equipo-switches'], ['cableado', 'equipo-cableado']
  ];
  const iconoEquipo = txt => {
    const t = txt.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const m = EQUIPO_ICONO.find(([k]) => t.includes(k));
    return icono(m ? m[1] : 'menu-espacios');
  };
  async function viewFicha(id) {
    const e = espacioPor(id);
    if (!e) return shell('espacios', '<p class="vacio">Ese espacio no existe. <a href="#/espacios">Volver a espacios</a></p>');
    const fecha = (S.sel && S.sel.espacioId === id) ? S.sel.fecha : S.f.fecha;
    S._fichaFecha = fecha;
    const rs = (await A().reservasActivas(fecha)).filter(r => r.espacio_id === id);
    S._fichaRs = rs;
    const st = estadoEn(e, rs, horaInicial());
    const aviso = S.avisoFicha; S.avisoFicha = null;
    S._fichaId = id;
    if (aviso) S._avisoToast = aviso; else S._franjaNd = null;   // el aviso se muestra como aviso flotante al pintar
    const sel = S.sel && S.sel.espacioId === id && S.sel.fecha === fecha ? S.sel : null;
    const mant = e.estado === 'mantenimiento';
    const ubic = (e.ubicacion || '').split('·').pop().trim() || e.aula;
    return shell('espacios', `
      <button type="button" class="back" data-act="volver-espacios">← Volver a espacios</button>
      <div class="head">
        <div>
          <div class="eyebrow">Espacio · ${esc(e.tipo)}</div>
          <div class="h1row"><h1>${esc(e.nombre)}</h1><span class="pill p-disponible">${esc(mant ? 'Mantenimiento' : etqCard(st))}</span></div>
          <p class="sub">${esc(e.ubicacion)}</p>
        </div>
        <div class="row"><span class="upd"><i></i>Actualizado ${horaReloj()}</span></div>
      </div>
      <div class="ficha">
        <div class="f-izq">
          <div class="ficha-foto" style="background-image:${urlFoto(e)}" role="img" aria-label="Foto de ${esc(e.nombre)}"></div>
          <section class="card f-info" aria-label="Información del espacio">
            <h3>Información</h3>
            <div class="chips2">
              <div class="ichip"><span class="ib">${icono('info-capacidad')}</span>Capacidad: ${e.capacidad} personas</div>
              <div class="ichip"><span class="ib">${icono('info-ubicacion')}</span>${esc(ubic)}</div>
            </div>
            <h4>Equipos</h4>
            <ul class="eq-grid">${e.equipos.map(x => `<li class="eq">${iconoEquipo(x)}<span>${esc(x)}</span></li>`).join('')}</ul>
          </section>
          <section class="normas2" aria-label="Normas de uso">
            <h3>Normas de uso</h3>
            <ul>${e.normas.map(n => `<li${/^requiere/i.test(n) ? ' class="fuerte"' : ''}>${esc(n)}</li>`).join('')}</ul>
          </section>
        </div>
        <section class="card f-disp" aria-label="Disponibilidad">
          <h3>Disponibilidad</h3>
          <div id="aviso-ficha">${mant ? avisoHtml('info', 'Espacio en mantenimiento', 'No se puede reservar por ahora.') : ''}</div>
          <div class="fecha-sel"><select class="sel" id="ficha-fecha" aria-label="Fecha">${opcionesFecha(fecha, S.ajustes.anticipacion_dias || 7)}</select></div>
          <img class="f-ilus" src="img/ilustraciones/ficha.jpg" width="1000" height="331" alt="">
          <div class="slots" id="slots">${panelFranjas(e, rs, fecha)}</div>
          <div id="sel-info"></div>
          <button type="button" class="btn primary btn-reservar" id="btn-reservar" data-act="ir-reservar" ${sel ? '' : 'disabled'}>${e.requiere_aprobacion ? 'Solicitar franja seleccionada' : 'Reservar franja seleccionada'}</button>
        </section>
      </div>`);
  }
  const avisoHtml = (tipo, titulo, texto) => `<div class="aviso ${tipo}" role="alert"><div><b>${esc(titulo)}</b>${esc(texto || '')}</div><button class="x" data-act="cerrar-aviso" aria-label="Cerrar">×</button></div>`;
  function pintarSel() {
    if (S._avisoToast) { const a = S._avisoToast; S._avisoToast = null; toast(a.titulo, a.texto, 'err'); }
    const info = document.getElementById('sel-info'), btn = document.getElementById('btn-reservar');
    if (!info) return;
    const s = S.sel;
    if (s && s.fecha === S._fichaFecha) { info.innerHTML = `<div class="sel-info">Franja elegida: <b>${esc(etiquetaFecha(s.fecha).toLowerCase())}, ${rangoLargo(s.desde, s.hasta)}</b></div>`; btn.disabled = false; }
    else if (S._franjaNd != null) { info.innerHTML = '<p class="err-m">Elige otra franja para continuar.</p>'; btn.disabled = true; }
    else { info.innerHTML = '<p class="m" style="margin-bottom:10px">Elige una franja libre para continuar.</p>'; btn.disabled = true; }
  }
  // Se pulsó una franja ocupada: aviso flotante, franja marcada en rojo y mensaje bajo la lista
  function franjaNoDisponible(h) {
    const e = espacioPor(S._fichaId); if (!e) return;
    S._franjaNd = h;
    if (e.estado === 'mantenimiento') toast('Espacio en mantenimiento', 'No se puede reservar por ahora.', 'err');
    else toast('Esta franja ya no está disponible', 'Alguien reservó ' + rango(h, h + 1) + ' hace un momento. Elige otra franja libre.', 'err');
    const sl = document.getElementById('slots'); if (sl) sl.innerHTML = panelFranjas(e, S._fichaRs, S._fichaFecha);
    pintarSel();
  }

  // ---------- CONFIRMAR RESERVA ----------
  const MOTIVOS = ['Práctica de laboratorio', 'Clase', 'Reunión', 'Taller', 'Conferencia o evento', 'Otro'];
  async function viewReservar() {
    const s = S.sel; if (!s) { location.hash = '#/espacios'; return ''; }
    const e = espacioPor(s.espacioId);
    const lib = S.ajustes.liberar_min || 15;
    const infoIco = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 11v6M12 7.5v.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    const como = e.requiere_aprobacion
      ? { t: 'Esta sala requiere aprobación', pasos: ['Envías tu solicitud.', 'Un administrador la revisa.', 'Te avisamos si fue aprobada.'], nota: 'Mismos campos que la reserva normal' }
      : { t: 'Tu reserva se confirma al instante', pasos: ['Confirmas tu reserva.', 'Llegas a la hora indicada.', `Confirmas tu llegada en los primeros ${lib} minutos desde Mis reservas.`], nota: 'Capacidad del espacio: ' + e.capacidad + ' personas.' };
    return shell('reservas', `
      <button type="button" class="back" data-act="volver-ficha">← Volver a la ficha</button>
      <div class="head"><h1>Confirmar reserva</h1></div>
      <div class="reservar">
        <form class="form-card" id="form-reserva" novalidate>
          ${S.reprogramar ? avisoHtml('info', 'Estás reprogramando una reserva', 'Al confirmar, la anterior se cancela.') : ''}
          <div class="rsm">
            <div><span>Espacio:</span> <b>${esc(e.nombre)}</b></div>
            <div><span>Aula:</span> <b>${esc(e.aula.replace(/^Aula\s+/i, ''))}</b></div>
            <div><span>Fecha:</span> <b>${esc(etiquetaFecha(s.fecha))}</b></div>
            <div><span>Hora:</span> <b>${rangoLargo(s.desde, s.hasta)}</b></div>
          </div>
          <div class="field"><label class="f" for="r-motivo">Motivo</label>
            <select class="sel" id="r-motivo"><option value="">Selecciona un motivo</option>${MOTIVOS.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('')}</select>
            <input class="in otro" id="r-motivo-otro" placeholder="Escribe el motivo" aria-label="Escribe el motivo" hidden>
            <div class="msg-err" id="e-motivo" hidden></div></div>
          <div class="field"><label class="f" for="r-asist">Número de asistentes</label><input class="in" id="r-asist" type="number" min="1" inputmode="numeric" placeholder="Ej. 20 (máximo ${e.capacidad})"><div class="msg-err" id="e-asist" hidden></div></div>
          <div class="field"><label class="f" for="r-notas">Notas (opcional)</label><textarea class="in" id="r-notas" placeholder="Equipos o necesidades especiales"></textarea></div>
          <div class="field chk"><label><input type="checkbox" id="r-normas"> Acepto las normas de uso del espacio</label><div class="msg-err" id="e-normas" hidden></div></div>
          <div class="acts row"><button type="button" class="btn outline" data-act="volver-ficha">Cancelar</button><button class="btn primary" type="submit" id="btn-enviar">${e.requiere_aprobacion ? 'Enviar solicitud' : 'Confirmar reserva'}</button></div>
        </form>
        <aside class="r-side">
          <section class="como" aria-label="Cómo funciona">
            <div class="mono-l">¿Cómo funciona?</div>
            <h2>${como.t}</h2>
            <div class="pasos-box"><span class="i-info">${infoIco}</span><ol>${como.pasos.map(p => `<li>${esc(p)}</li>`).join('')}</ol></div>
            <p class="m">${esc(como.nota)}</p>
          </section>
          <div class="r-ilus"><img src="img/ilustraciones/confirmar-reserva.jpg" width="1000" height="1000" alt=""></div>
        </aside>
      </div>`);
  }
  async function enviarReserva() {
    const s = S.sel, e = espacioPor(s.espacioId);
    const asist = document.getElementById('r-asist'), motivo = document.getElementById('r-motivo'), otro = document.getElementById('r-motivo-otro'), normas = document.getElementById('r-normas');
    // El motivo sale de la lista; con "Otro" se usa el texto que escriba la persona.
    const campoMotivo = () => (motivo.value === 'Otro' ? otro : motivo);
    const textoMotivo = () => (motivo.value === 'Otro' ? otro.value : motivo.value).trim();
    const set = (id, inp, msg) => { const el = document.getElementById(id); el.hidden = !msg; el.textContent = msg || ''; if (inp) inp.classList.toggle('err', !!msg); };
    const n = parseInt(asist.value, 10);
    let ok = true;
    if (!n || n < 1) { set('e-asist', asist, 'Indica cuántas personas asistirán.'); ok = false; }
    else if (n > e.capacidad) { set('e-asist', asist, 'Supera la capacidad de la sala (' + e.capacidad + ' personas).'); ok = false; }
    else set('e-asist', asist, '');
    [motivo, otro].forEach(x => x.classList.remove('err'));
    if (!textoMotivo()) { set('e-motivo', campoMotivo(), 'Cuéntanos el motivo de la reserva.'); ok = false; } else set('e-motivo', null, '');
    if (!normas.checked) { set('e-normas', null, 'Debes aceptar las normas de uso.'); ok = false; } else set('e-normas', null, '');
    if (!ok) return;
    const btn = document.getElementById('btn-enviar'); btn.disabled = true; btn.textContent = 'Enviando…';
    try {
      const r = await A().crearReserva({ espacio_id: s.espacioId, fecha: s.fecha, hora_inicio: s.desde, hora_fin: s.hasta, asistentes: n, motivo: textoMotivo(), notas: document.getElementById('r-notas').value }, S.user);
      if (S.reprogramar) { try { await A().actualizarReserva(S.reprogramar, { estado: 'cancelada', nota_estado: 'Reprogramada' }); } catch (x) { /* ignora */ } S.reprogramar = null; }
      S.sel = null;
      location.hash = '#/confirmada/' + r.id;
    } catch (err) {
      btn.disabled = false; btn.textContent = e.requiere_aprobacion ? 'Enviar solicitud' : 'Confirmar reserva';
      if (err.codigo === 'FRANJA_OCUPADA') { S._franjaNd = s.desde; S.avisoFicha = { titulo: 'Esta franja ya no está disponible', texto: 'Alguien reservó ' + rango(s.desde, s.hasta) + ' hace un momento. Elige otra franja libre.' }; S.sel = null; location.hash = '#/espacio/' + s.espacioId; }
      else if (err.codigo === 'CAPACIDAD') set('e-asist', asist, err.message);
      else if (err.codigo === 'MOTIVO') set('e-motivo', campoMotivo(), err.message);
      else toast('No se pudo reservar', err.message, 'err');
    }
  }

  // ---------- RESERVA CONFIRMADA ----------
  async function viewConfirmada(id) {
    const r = await A().reserva(id);
    if (!r) return shell('reservas', '<p class="vacio">No encontramos esa reserva. <a href="#/reservas">Ir a Mis reservas</a></p>');
    const e = espacioPor(r.espacio_id), pend = r.estado === 'pendiente', lib = S.ajustes.liberar_min || 15;
    const hasta = `${h12(r.hora_inicio)}:${String(lib).padStart(2, '0')} ${r.hora_inicio >= 12 ? 'pm' : 'am'}`;
    const ventana = `entre las ${fmtH(r.hora_inicio)} y las ${hasta}`;
    const icono1 = pend
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="#fff" stroke-width="2"/><path d="M12 7.5V12l3 2" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5l4 4 8-9" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    return shell('reservas', `
      ${cabecera('Campus UCC', 'Reservas', pend ? 'Tu solicitud quedó registrada. Revisa los detalles.' : 'Tu reserva quedó confirmada. Revisa los detalles.', '<a class="btn outline sm" href="#/reservas">Ver mis reservas</a>')}
      <div class="conf">
        <section class="card conf-card" aria-label="${pend ? 'Solicitud enviada' : 'Reserva confirmada'}">
          <div class="conf-ico ${pend ? 'pend' : ''}">${icono1}</div>
          <h2>${pend ? 'Solicitud enviada' : 'Reserva confirmada'}</h2>
          <div class="rsm conf-rsm">
            <div><span>Espacio:</span> <b>${esc(e.nombre)}</b></div>
            <div><span>Aula:</span> <b>${esc(e.aula.replace(/^Aula\s+/i, ''))}</b></div>
            <div><span>Fecha:</span> <b>${esc(etiquetaFecha(r.fecha))}</b></div>
            <div><span>Hora:</span> <b>${rango(r.hora_inicio, r.hora_fin)}</b></div>
            <div><span>Asistentes:</span> <b>${r.asistentes}</b></div>
            <div><span>Motivo:</span> <b>${esc(r.motivo)}</b></div>
          </div>
          <p class="conf-nota">${pend ? `Un administrador revisará tu solicitud y te avisaremos. Si la aprueban, confirma tu llegada desde Mis reservas ${ventana}.` : `Confirma tu llegada desde Mis reservas ${ventana}; si no, el espacio se libera.`}</p>
          <button type="button" class="btn rec" data-act="recordatorio" data-id="${r.id}">${icono('config-recordatorio')}Agregar recordatorio</button>
          <div class="conf-acts"><a class="btn outline" href="#/mapa">Volver al mapa</a><a class="btn primary" href="#/espacios">Reservar otro espacio</a></div>
        </section>
        <div class="conf-ilus"><img src="img/ilustraciones/reserva-confirmada.jpg" width="1000" height="1000" alt=""></div>
        <div class="conf-estado"><span class="pill-dash ${pend ? 'pend' : 'ok'}">${pend ? 'Pendiente de aprobación' : 'Confirmada'}</span></div>
      </div>`);
  }
  function descargarIcs(r, e) {
    const f = r.fecha.replace(/-/g, ''), p = n => String(n).padStart(2, '0');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CampuSpace//ES', 'BEGIN:VEVENT', 'UID:' + r.id + '@campuspace', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z',
      'DTSTART:' + f + 'T' + p(r.hora_inicio) + '0000', 'DTEND:' + f + 'T' + p(r.hora_fin) + '0000', 'SUMMARY:Reserva en ' + e.nombre, 'LOCATION:' + e.ubicacion + ' · ' + e.aula, 'DESCRIPTION:' + (r.motivo || ''),
      'BEGIN:VALARM', 'TRIGGER:-PT' + (S.ajustes.recordatorio_min || 30) + 'M', 'ACTION:DISPLAY', 'DESCRIPTION:Tu reserva comienza pronto', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = 'reserva-campuspace.ics';
    document.body.appendChild(a); a.click(); a.remove();
  }

  CS.views = Object.assign(CS.views || {}, { shell, cabecera, viewLogin, enviarLogin, cargarBase, viewMapa, pintarMapa, viewEspacios, pintarEspacios, viewFicha, pintarSel, panelFranjas, estadoFranja, viewReservar, enviarReserva, viewConfirmada, descargarIcs, esAdmin, espacioPor, avisoHtml, horaInicial, franjaNoDisponible });
})();
