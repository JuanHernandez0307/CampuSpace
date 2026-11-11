// ============================================================
// Capa de datos de CampuSpace
// Dos implementaciones con la MISMA interfaz:
//   - Supabase (base de datos real)  -> si config.js tiene URL y clave
//   - Demostración (localStorage)    -> si config.js está vacío
// ============================================================
(function () {
  const CFG = window.CS_CONFIG || {};
  const DOMINIO = '@campusucc.edu.co';
  const HORA_MIN = 7, HORA_MAX = 19;           // el campus abre de 7:00 a 19:00
  const ACTIVAS = ['pendiente', 'confirmada', 'asistio'];

  // ---------- utilidades de fecha ----------
  const pad = n => String(n).padStart(2, '0');
  const isoDe = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const hoyISO = () => isoDe(new Date());
  const sumarDias = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoDe(d); };
  const horaActual = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60; };

  // ---------- datos base (los mismos del SQL) ----------
  const ESPACIOS = [
    { id: 'sala-audiencias', nombre: 'Sala de audiencias', tipo: 'Sala', aula: 'Aula 220', ubicacion: 'Facultad de Derecho · Bloque C, piso 1', capacidad: 40, requiere_aprobacion: true, estado: 'activo',
      equipos: ['Estrado', 'Mesas para las partes', '40 sillas', 'Micrófonos', 'Proyector'],
      normas: ['Requiere aprobación de un administrador', 'Confirma tu llegada en los primeros 15 minutos', 'Máximo 2 horas por reserva'] },
    { id: 'lab-fisica', nombre: 'Laboratorio de física', tipo: 'Laboratorio', aula: 'Aula 220', ubicacion: 'Campus UCC · Aula 220', capacidad: 35, requiere_aprobacion: false, estado: 'activo',
      equipos: ['Generador Van de Graaff', 'Mesas', '40 sillas', 'Carril de dinámica', 'Televisor', 'Kit de circuitos y medición'],
      normas: ['Confirma tu llegada en los primeros 15 minutos', 'No consumas alimentos ni bebidas', 'Usa el generador de Van de Graaff solo con el docente', 'Deja los equipos ordenados al terminar'] },
    { id: 'lab-psicologia', nombre: 'Laboratorio de psicología', tipo: 'Laboratorio', aula: 'Aula 219', ubicacion: 'Campus UCC · Aula 219', capacidad: 25, requiere_aprobacion: false, estado: 'activo',
      equipos: ['Microscopios', 'Mesones de laboratorio', '30 sillas', 'Elementos de bioseguridad', 'Kit de muestras y tubos', 'Modelos anatómicos'],
      normas: ['Confirma tu llegada en los primeros 15 minutos', 'Usa bata y guantes al manipular muestras', 'No consumas alimentos ni bebidas', 'Deja los implementos limpios y en su lugar'] },
    { id: 'camara-gesell', nombre: 'Cámara de Gesell', tipo: 'Sala', aula: 'Aula 202', ubicacion: 'Campus UCC · Aula 202', capacidad: 8, requiere_aprobacion: true, estado: 'activo',
      equipos: ['Espejo unidireccional', 'Cámaras de video', 'Sala de observación', 'Micrófonos', 'Material lúdico', 'Sistema de audio'],
      normas: ['Requiere aprobación de un administrador', 'Confirma tu llegada en los primeros 15 minutos', 'Guarda silencio en la sala de observación', 'No tomes fotos ni videos de las sesiones'] },
    { id: 'lab-contaduria', nombre: 'Laboratorio de Contaduría', tipo: 'Laboratorio', aula: 'Aula 317', ubicacion: 'Campus UCC · Aula 219', capacidad: 30, requiere_aprobacion: false, estado: 'activo',
      equipos: ['Equipos de cómputo', 'Mesas', '35 sillas', 'Software contable', 'Proyector'],
      normas: ['Confirma tu llegada en los primeros 15 minutos', 'No consumas alimentos ni bebidas', 'No instales programas en los equipos', 'Desocupa el laboratorio al salir el docente'] },
    { id: 'sala-sistemas-2', nombre: 'Sala de sistemas 2', tipo: 'Sala', aula: 'Aula 509', ubicacion: 'Campus UCC · Aula 509', capacidad: 32, requiere_aprobacion: false, estado: 'activo',
      equipos: ['Equipos de cómputo', 'Mesas', '40 sillas', 'Cámara de vigilancia', 'Proyector'],
      normas: ['Confirma tu llegada en los primeros 15 minutos', 'No consumas alimentos ni bebidas', 'No instales programas en los equipos', 'Desocupa la sala al salir el docente'] },
    { id: 'auditorio-principal', nombre: 'Auditorio principal', tipo: 'Auditorio', aula: 'Auditorio principal', ubicacion: 'Campus UCC · Auditorio principal', capacidad: 200, requiere_aprobacion: true, estado: 'activo',
      equipos: ['Atril y escenario', 'Sistema de sonido', '200 butacas', 'Micrófonos', 'Pantalla y proyector', 'Sillas para invitados'],
      normas: ['Requiere aprobación de un administrador', 'Confirma tu llegada en los primeros 15 minutos', 'Solo puede usarse con la compañía de un docente', 'Deja el escenario y los equipos en orden'] },
    { id: 'auditorio-4piso', nombre: 'Auditorio 4 piso', tipo: 'Auditorio', aula: 'Aula 401', ubicacion: 'Campus UCC · Aula especial 401', capacidad: 80, requiere_aprobacion: true, estado: 'activo',
      equipos: ['Atril y escenario', 'Sistema de sonido', '80 butacas', 'Micrófonos', 'Pantalla y proyector', 'Mesas'],
      normas: ['Requiere aprobación de un administrador', 'Confirma tu llegada en los primeros 15 minutos', 'Solo puede usarse con la compañía de un docente', 'Deja el escenario y los equipos en orden'] },
    { id: 'lab-redes', nombre: 'Laboratorio de redes', tipo: 'Laboratorio', aula: 'Aula 508', ubicacion: 'Campus UCC · Aula 508', capacidad: 24, requiere_aprobacion: false, estado: 'mantenimiento',
      equipos: ['Equipos de cómputo', 'Mesas y sillas', 'Proyector', 'Routers', 'Switches', 'Cableado y herramientas'],
      normas: ['Confirma tu llegada en los primeros 15 minutos', 'No desconectes equipos ni cables sin el docente', 'No instales programas en los equipos', 'Desocupa el laboratorio al salir el docente'] },
    { id: 'lab-enfermeria', nombre: 'Laboratorio de Enfermería', tipo: 'Laboratorio', aula: 'Aula 215', ubicacion: 'Campus UCC · Aula 215', capacidad: 34, requiere_aprobacion: false, estado: 'activo',
      equipos: ['Camillas', 'Simuladores clínicos', '40 sillas', 'Insumos médicos', 'Elementos de bioseguridad', 'Lavamanos y aseo'],
      normas: ['Confirma tu llegada en los primeros 15 minutos', 'Usa uniforme y elementos de bioseguridad', 'Lávate las manos antes y después de la práctica', 'Desocupa el laboratorio al salir el docente'] }
  ];
  const CUENTAS = [
    { email: 'estudiante@campusucc.edu.co', password: 'Campus2026*', nombre: 'Daniel Gómez', rol: 'estudiante', programa: 'Derecho' },
    { email: 'docente@campusucc.edu.co', password: 'Campus2026*', nombre: 'Armando Rivera', rol: 'docente', programa: 'Derecho' },
    { email: 'admin@campusucc.edu.co', password: 'Admin2026*', nombre: 'Admin CampuSpace', rol: 'administrador', programa: 'Administración' }
  ];
  const AJUSTES_BASE = { liberar_min: 15, duracion_max: 2, anticipacion_dias: 7, recordatorio_min: 30 };

  // ---------- reglas compartidas ----------
  function errorApp(codigo, mensaje) { const e = new Error(mensaje); e.codigo = codigo; return e; }

  function validarReserva(r, espacio, ajustes) {
    if (!espacio) throw errorApp('ESPACIO', 'El espacio no existe.');
    if (espacio.estado !== 'activo') throw errorApp('MANTENIMIENTO', 'Este espacio está en mantenimiento.');
    const dur = r.hora_fin - r.hora_inicio;
    if (dur < 1) throw errorApp('FRANJA', 'Elige al menos una franja.');
    if (dur > ajustes.duracion_max) throw errorApp('DURACION', 'La duración máxima es de ' + ajustes.duracion_max + ' horas.');
    const hoy = hoyISO();
    if (r.fecha < hoy) throw errorApp('FECHA', 'No puedes reservar en una fecha pasada.');
    if (r.fecha > sumarDias(hoy, ajustes.anticipacion_dias)) throw errorApp('FECHA', 'Solo puedes reservar con ' + ajustes.anticipacion_dias + ' días de anticipación.');
    if (r.fecha === hoy && r.hora_inicio + (ajustes.liberar_min || 15) / 60 <= horaActual()) throw errorApp('FRANJA', 'Esa franja ya pasó.');
    if (!r.asistentes || r.asistentes < 1) throw errorApp('ASISTENTES', 'Indica el número de asistentes.');
    if (r.asistentes > espacio.capacidad) throw errorApp('CAPACIDAD', 'Supera la capacidad de la sala (' + espacio.capacidad + ' personas).');
    if (!r.motivo || !r.motivo.trim()) throw errorApp('MOTIVO', 'Cuéntanos el motivo de la reserva.');
  }

  function validarCorreo(email) {
    const e = (email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw errorApp('CORREO', 'Escribe un correo válido.');
    if (!e.endsWith(DOMINIO)) throw errorApp('DOMINIO', 'Usa tu correo institucional (' + DOMINIO + ').');
    return e;
  }

  // ============================================================
  //  MODO DEMOSTRACIÓN (localStorage)
  // ============================================================
  const KEY = 'campuspace-demo-v4';   // v4: equipos de cada espacio como en el diseño (v3: ejemplo de cada estado del mapa)
  const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return Math.abs(h); };
  let _id = 0;
  const nuevoId = () => 'r' + Date.now().toString(36) + (++_id);

  function sembrar() {
    const hoy = hoyISO();
    const reservas = [];
    const add = (o) => reservas.push(Object.assign({ id: nuevoId(), usuario_id: null, solicitante: 'Reserva de ejemplo', programa: 'Campus UCC', asistentes: 10, motivo: 'Clase programada', notas: '', estado: 'confirmada', necesita_aprobacion: false, motivo_rechazo: null, llegada_confirmada: false, nota_estado: null, creada: new Date().toISOString() }, o));
    const libre = (esp, f, h0, h1) => !reservas.some(r => r.espacio_id === esp && r.fecha === f && ACTIVAS.includes(r.estado) && r.hora_inicio < h1 && h0 < r.hora_fin);
    ESPACIOS.filter(e => e.estado === 'activo').forEach(e => {
      for (let d = 0; d <= 6; d++) for (let h = 7; h <= 17; h++) {
        if (hash(e.id + d + '|' + h) % 100 < 24) add({ espacio_id: e.id, fecha: sumarDias(hoy, d), hora_inicio: h, hora_fin: h + 1, necesita_aprobacion: false });
      }
    });
    const forzar = (o) => { for (let i = reservas.length - 1; i >= 0; i--) { const r = reservas[i]; if (r.espacio_id === o.espacio_id && r.fecha === o.fecha && r.hora_inicio < o.hora_fin && o.hora_inicio < r.hora_fin) reservas.splice(i, 1); } add(o); };
    const hace = (ms) => new Date(Date.now() - ms).toISOString();
    // Ejemplos de TODOS los estados del mapa a la hora en que se abre (9 am si es fuera de horario):
    // pendiente (audiencias), ocupado (enfermería) y reservado pronto (auditorio); en mantenimiento ya es lab-redes.
    const hAct = horaActual(), hDemo = (hAct < 7 || hAct >= 18.75) ? 9 : Math.min(17, Math.floor(hAct));
    const despejar = (esp, f, h0, h1) => { for (let i = reservas.length - 1; i >= 0; i--) { const r = reservas[i]; if (r.espacio_id === esp && r.fecha === f && r.hora_inicio < h1 && h0 < r.hora_fin) reservas.splice(i, 1); } };
    forzar({ espacio_id: 'sala-audiencias', fecha: hoy, hora_inicio: hDemo, hora_fin: hDemo + 1, solicitante: 'Ana Pérez', programa: 'Derecho', asistentes: 20, motivo: 'Simulación de audiencia', estado: 'pendiente', necesita_aprobacion: true, creada: hace(2 * 3600e3) });
    forzar({ espacio_id: 'lab-enfermeria', fecha: hoy, hora_inicio: hDemo, hora_fin: hDemo + 1, solicitante: 'Sofía Ramírez', programa: 'Enfermería', asistentes: 28, motivo: 'Práctica de signos vitales' });
    despejar('auditorio-principal', hoy, hDemo, hDemo + 1);
    forzar({ espacio_id: 'auditorio-principal', fecha: hoy, hora_inicio: hDemo + 1, hora_fin: hDemo + 2, solicitante: 'Carlos Ruiz', programa: 'Admin de empresas', asistentes: 120, motivo: 'Ensayo de grado', estado: 'confirmada', necesita_aprobacion: true });
    forzar({ espacio_id: 'camara-gesell', fecha: sumarDias(hoy, 1), hora_inicio: 9, hora_fin: 11, solicitante: 'Laura Gómez', programa: 'Psicología', asistentes: 6, motivo: 'Práctica de entrevista clínica', estado: 'pendiente', necesita_aprobacion: true, creada: hace(5 * 3600e3) });
    forzar({ espacio_id: 'auditorio-principal', fecha: sumarDias(hoy, 4), hora_inicio: 14, hora_fin: 16, solicitante: 'Carlos Ruiz', programa: 'Admin de empresas', asistentes: 120, motivo: 'Conferencia de semilleros', estado: 'pendiente', necesita_aprobacion: true, creada: hace(24 * 3600e3) });
    forzar({ espacio_id: 'auditorio-4piso', fecha: sumarDias(hoy, 5), hora_inicio: 8, hora_fin: 10, solicitante: 'María Torres', programa: 'Enfermería', asistentes: 60, motivo: 'Charla de bioseguridad', estado: 'confirmada', necesita_aprobacion: true, creada: hace(48 * 3600e3) });
    add({ espacio_id: 'lab-contaduria', fecha: sumarDias(hoy, 2), hora_inicio: 10, hora_fin: 12, solicitante: 'Pedro Salazar', programa: 'Contaduría', asistentes: 80, motivo: 'Evento externo', estado: 'rechazada', motivo_rechazo: 'El laboratorio tiene capacidad para 30 personas.', creada: hace(72 * 3600e3) });
    // historial de la demostración de analítica (semanas anteriores)
    ESPACIOS.filter(e => e.estado === 'activo').forEach(e => {
      for (let d = 1; d <= 28; d++) for (let h = 7; h <= 17; h++) {
        const x = hash('p' + e.id + d + '|' + h) % 100;
        if (x < 30) {
          const f = sumarDias(hoy, -d);
          if (libre(e.id, f, h, h + 1)) {
            const fallo = hash('f' + e.id + d + h) % 100 < 14;
            add({ espacio_id: e.id, fecha: f, hora_inicio: h, hora_fin: h + 1, estado: fallo ? 'no_asistio' : 'asistio', llegada_confirmada: !fallo, necesita_aprobacion: false });
          }
        }
      }
    });
    // reservas del estudiante de demostración
    const u = CUENTAS[0];
    const mia = (o) => add(Object.assign({ usuario_id: u.email, solicitante: u.nombre, programa: u.programa }, o));
    mia({ espacio_id: 'lab-fisica', fecha: sumarDias(hoy, 1), hora_inicio: 8, hora_fin: 9, asistentes: 25, motivo: 'Práctica de laboratorio' });
    mia({ espacio_id: 'sala-sistemas-2', fecha: sumarDias(hoy, 2), hora_inicio: 14, hora_fin: 16, asistentes: 30, motivo: 'Taller de programación' });
    forzar({ usuario_id: u.email, solicitante: u.nombre, programa: u.programa, espacio_id: 'auditorio-principal', fecha: sumarDias(hoy, 3), hora_inicio: 8, hora_fin: 10, asistentes: 120, motivo: 'Conferencia de semilleros', estado: 'pendiente', necesita_aprobacion: true });
    mia({ espacio_id: 'lab-psicologia', fecha: sumarDias(hoy, -3), hora_inicio: 14, hora_fin: 15, asistentes: 20, motivo: 'Práctica clínica', estado: 'asistio', llegada_confirmada: true });
    mia({ espacio_id: 'auditorio-4piso', fecha: sumarDias(hoy, -4), hora_inicio: 9, hora_fin: 10, asistentes: 40, motivo: 'Reunión de grupo', estado: 'no_asistio', necesita_aprobacion: true, nota_estado: 'Se liberó a las 9:15 am' });
    return { v: 4, espacios: JSON.parse(JSON.stringify(ESPACIOS)), reservas, ajustes: Object.assign({}, AJUSTES_BASE), sesion: null };
  }
  function cargar() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 4) return s; } catch (e) { /* ignora */ }
    const s = sembrar(); guardar(s); return s;
  }
  function guardar(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignora */ } }

  const Demo = {
    modo: 'demo',
    async login(email, password) {
      const e = validarCorreo(email);
      const c = CUENTAS.find(x => x.email === e);
      if (!c || c.password !== password) throw errorApp('CREDENCIALES', 'Correo o contraseña incorrectos.');
      const s = cargar(); s.sesion = c.email; guardar(s);
      return Demo.sesion();
    },
    async logout() { const s = cargar(); s.sesion = null; guardar(s); },
    async sesion() {
      const s = cargar(); const c = CUENTAS.find(x => x.email === s.sesion);
      return c ? { id: c.email, email: c.email, nombre: c.nombre, rol: c.rol, programa: c.programa } : null;
    },
    async espacios() { return cargar().espacios; },
    async ajustes() { return cargar().ajustes; },
    async reservasActivas(fecha) { return cargar().reservas.filter(r => r.fecha === fecha && ACTIVAS.includes(r.estado)); },
    async crearReserva(r, user) {
      const s = cargar(); const esp = s.espacios.find(e => e.id === r.espacio_id);
      validarReserva(r, esp, s.ajustes);
      const choque = s.reservas.some(x => x.espacio_id === r.espacio_id && x.fecha === r.fecha && ACTIVAS.includes(x.estado) && x.hora_inicio < r.hora_fin && r.hora_inicio < x.hora_fin);
      if (choque) throw errorApp('FRANJA_OCUPADA', 'Esta franja ya no está disponible.');
      const nueva = { id: nuevoId(), usuario_id: user.id, solicitante: user.nombre, programa: user.programa, fecha: r.fecha, hora_inicio: r.hora_inicio, hora_fin: r.hora_fin, asistentes: r.asistentes, motivo: r.motivo.trim(), notas: r.notas || '', espacio_id: r.espacio_id, necesita_aprobacion: !!esp.requiere_aprobacion, estado: esp.requiere_aprobacion ? 'pendiente' : 'confirmada', motivo_rechazo: null, llegada_confirmada: false, nota_estado: null, creada: new Date().toISOString() };
      s.reservas.push(nueva); guardar(s); return nueva;
    },
    async reserva(id) { return cargar().reservas.find(r => r.id === id) || null; },
    async misReservas(user) { return cargar().reservas.filter(r => r.usuario_id === user.id); },
    async todasReservas() { return cargar().reservas; },
    async actualizarReserva(id, cambios) {
      const s = cargar(); const r = s.reservas.find(x => x.id === id);
      if (!r) throw errorApp('NO_EXISTE', 'La reserva no existe.');
      Object.assign(r, cambios); guardar(s); return r;
    },
    async guardarAjustes(a) { const s = cargar(); s.ajustes = Object.assign(s.ajustes, a); guardar(s); },
    async guardarEspacio(id, c) { const s = cargar(); const e = s.espacios.find(x => x.id === id); Object.assign(e, c); guardar(s); },
    async reiniciarDemo() { localStorage.removeItem(KEY); }
  };

  // ============================================================
  //  MODO SUPABASE (base de datos real)
  // ============================================================
  function crearSupabase() {
    const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
    let perfilCache = null;
    const lanza = (error) => { if (error) { const e = new Error(error.message); e.codigo = error.code; throw e; } };

    async function perfilDe(uid) {
      const { data, error } = await sb.from('perfiles').select('*').eq('id', uid).single();
      lanza(error); perfilCache = data; return data;
    }
    return {
      modo: 'supabase',
      async login(email, password) {
        const e = validarCorreo(email);
        const { data, error } = await sb.auth.signInWithPassword({ email: e, password });
        if (error) throw errorApp('CREDENCIALES', 'Correo o contraseña incorrectos.');
        return perfilDe(data.user.id);
      },
      async logout() { perfilCache = null; await sb.auth.signOut(); },
      async sesion() {
        const { data } = await sb.auth.getSession();
        if (!data.session) return null;
        return perfilCache || perfilDe(data.session.user.id);
      },
      async espacios() { const { data, error } = await sb.from('espacios').select('*').order('nombre'); lanza(error); return data; },
      async ajustes() { const { data, error } = await sb.from('ajustes').select('*').eq('id', 1).single(); lanza(error); return data; },
      async reservasActivas(fecha) {
        const { data, error } = await sb.from('reservas').select('*').eq('fecha', fecha).in('estado', ACTIVAS); lanza(error); return data;
      },
      async crearReserva(r, user) {
        const [esp, aj] = await Promise.all([sb.from('espacios').select('*').eq('id', r.espacio_id).single(), Supabase.ajustes()]);
        lanza(esp.error); validarReserva(r, esp.data, aj);
        const fila = { espacio_id: r.espacio_id, usuario_id: user.id, solicitante: user.nombre, programa: user.programa, fecha: r.fecha, hora_inicio: r.hora_inicio, hora_fin: r.hora_fin, asistentes: r.asistentes, motivo: r.motivo.trim(), notas: r.notas || '', necesita_aprobacion: !!esp.data.requiere_aprobacion, estado: esp.data.requiere_aprobacion ? 'pendiente' : 'confirmada' };
        const { data, error } = await sb.from('reservas').insert(fila).select().single();
        if (error) { if (error.code === '23P01') throw errorApp('FRANJA_OCUPADA', 'Esta franja ya no está disponible.'); lanza(error); }
        return data;
      },
      async reserva(id) { const { data, error } = await sb.from('reservas').select('*').eq('id', id).maybeSingle(); lanza(error); return data; },
      async misReservas(user) { const { data, error } = await sb.from('reservas').select('*').eq('usuario_id', user.id).order('fecha').order('hora_inicio'); lanza(error); return data; },
      async todasReservas() {
        const desde = sumarDias(hoyISO(), -45);
        const { data, error } = await sb.from('reservas').select('*').gte('fecha', desde).order('fecha'); lanza(error); return data;
      },
      async actualizarReserva(id, cambios) { const { data, error } = await sb.from('reservas').update(cambios).eq('id', id).select().single(); lanza(error); return data; },
      async guardarAjustes(a) { const { error } = await sb.from('ajustes').update(a).eq('id', 1); lanza(error); },
      async guardarEspacio(id, c) { const { error } = await sb.from('espacios').update(c).eq('id', id); lanza(error); },
      async reiniciarDemo() { /* no aplica */ }
    };
  }

  let Supabase = null;
  const usaSupabase = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase);
  if (usaSupabase) Supabase = crearSupabase();

  window.CS = window.CS || {};
  Object.assign(window.CS, {
    api: usaSupabase ? Supabase : Demo,
    DOMINIO, HORA_MIN, HORA_MAX, ACTIVAS, CUENTAS,
    util: { pad, isoDe, hoyISO, sumarDias, horaActual, errorApp }
  });
})();
