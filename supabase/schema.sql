-- ============================================================
-- CampuSpace · base de datos completa para Supabase (PostgreSQL)
--
-- UN SOLO PASO: pega TODO este archivo en Supabase > SQL Editor > New query > Run.
-- Crea tablas, reglas de seguridad, validaciones en el servidor, los 10 espacios,
-- las 3 cuentas de acceso (con contraseña) y los datos de ejemplo.
--
-- Es seguro volver a ejecutarlo: BORRA y recrea las tablas de CampuSpace
-- (las cuentas de Authentication se conservan).
-- ============================================================

create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto   with schema extensions;

drop trigger if exists al_crear_usuario on auth.users;
drop table if exists public.reservas cascade;
drop table if exists public.perfiles cascade;
drop table if exists public.cuentas_autorizadas cascade;
drop table if exists public.espacios cascade;
drop table if exists public.ajustes cascade;
drop function if exists public.crear_perfil() cascade;
drop function if exists public.validar_reserva() cascade;
drop function if exists public.sembrar_reservas(uuid, text, text) cascade;
drop function if exists public.despejar(text, date, int, int) cascade;
drop function if exists public.generar_ejemplos(date, date) cascade;
drop function if exists public.avanzar_ejemplos() cascade;
drop function if exists public.reiniciar_demo(int) cascade;
drop function if exists public.hoy_bogota() cascade;
drop function if exists public.es_admin() cascade;

-- ------------------------------------------------------------
-- 1) Cuentas autorizadas (no hay registro: solo entran estas)
-- ------------------------------------------------------------
create table public.cuentas_autorizadas (
  email    text primary key check (email = lower(email) and email like '%@campusucc.edu.co'),
  nombre   text not null,
  rol      text not null check (rol in ('estudiante','docente','administrador')),
  programa text,
  semilla  boolean not null default false   -- si true, se cargan reservas de ejemplo propias
);

create table public.perfiles (
  id       uuid primary key references auth.users(id) on delete cascade,
  email    text not null unique,
  nombre   text not null,
  rol      text not null check (rol in ('estudiante','docente','administrador')),
  programa text
);

-- ------------------------------------------------------------
-- 2) Espacios
-- ------------------------------------------------------------
create table public.espacios (
  id                  text primary key,
  nombre              text not null,
  tipo                text not null check (tipo in ('Sala','Laboratorio','Auditorio')),
  aula                text not null,
  ubicacion           text not null default 'Campus UCC',
  capacidad           int  not null check (capacidad > 0),
  requiere_aprobacion boolean not null default false,
  estado              text not null default 'activo' check (estado in ('activo','mantenimiento')),
  equipos             text[] not null default '{}',
  normas              text[] not null default '{}',
  imagen              text                        -- URL opcional; si es null se usa img/espacios/<id>.jpg
);

-- ------------------------------------------------------------
-- 3) Reservas (las horas son enteras: 10 = 10:00)
-- ------------------------------------------------------------
create table public.reservas (
  id                 uuid primary key default gen_random_uuid(),
  espacio_id         text not null references public.espacios(id) on delete cascade,
  usuario_id         uuid references public.perfiles(id) on delete set null,
  solicitante        text not null,
  programa           text,
  fecha              date not null,
  hora_inicio        int  not null check (hora_inicio between 6 and 21),
  hora_fin           int  not null check (hora_fin between 7 and 22),
  asistentes         int  not null default 1 check (asistentes > 0),
  motivo             text,
  notas              text,
  estado             text not null check (estado in ('pendiente','confirmada','rechazada','cancelada','asistio','no_asistio')),
  necesita_aprobacion boolean not null default false,
  motivo_rechazo     text,
  llegada_confirmada boolean not null default false,
  nota_estado        text,
  creada             timestamptz not null default now(),
  es_ejemplo         boolean not null default false,   -- datos de demostración generados por el sistema
  check (hora_fin > hora_inicio)
);

-- Una franja no se puede reservar dos veces: la base de datos lo impide.
alter table public.reservas add constraint sin_cruces
  exclude using gist (
    espacio_id with =,
    fecha with =,
    int4range(hora_inicio, hora_fin) with &&
  ) where (estado in ('pendiente','confirmada','asistio'));

create index on public.reservas (fecha);
create index on public.reservas (usuario_id);
create index on public.reservas (es_ejemplo, fecha);

-- ------------------------------------------------------------
-- 4) Reglas globales (una sola fila)
-- ------------------------------------------------------------
create table public.ajustes (
  id                 int primary key default 1 check (id = 1),
  liberar_min        int not null default 15 check (liberar_min between 1 and 120),
  duracion_max       int not null default 2  check (duracion_max between 1 and 12),
  anticipacion_dias  int not null default 7  check (anticipacion_dias between 1 and 90),
  recordatorio_min   int not null default 30 check (recordatorio_min between 0 and 1440)
);
insert into public.ajustes default values;

-- ------------------------------------------------------------
-- 5) Funciones de apoyo
-- ------------------------------------------------------------
create or replace function public.hoy_bogota() returns date
language sql stable as $$ select (now() at time zone 'America/Bogota')::date $$;

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'administrador');
$$;

-- Quita reservas de ejemplo genéricas que se crucen con una franja (nunca las de personas reales)
create or replace function public.despejar(esp text, f date, h0 int, h1 int) returns void
language sql security definer set search_path = public as $$
  delete from public.reservas
  where espacio_id = esp and fecha = f and es_ejemplo and solicitante = 'Reserva de ejemplo'
    and hora_inicio < h1 and h0 < hora_fin;
$$;

-- Reservas de ejemplo propias de la cuenta de estudiante de demostración
create or replace function public.sembrar_reservas(uid uuid, nom text, prog text) returns void
language plpgsql security definer set search_path = public as $$
declare hoy date := public.hoy_bogota();
begin
  perform public.despejar('lab-fisica', hoy + 1, 8, 9);
  perform public.despejar('sala-sistemas-2', hoy + 2, 14, 16);
  perform public.despejar('auditorio-principal', hoy + 3, 8, 10);
  perform public.despejar('lab-psicologia', hoy - 3, 14, 15);
  perform public.despejar('auditorio-4piso', hoy - 4, 9, 10);
  insert into public.reservas (espacio_id, usuario_id, solicitante, programa, fecha, hora_inicio, hora_fin, asistentes, motivo, estado, necesita_aprobacion) values
    ('lab-fisica',          uid, nom, prog, hoy + 1, 8, 9,   25,  'Práctica de laboratorio',   'confirmada', false),
    ('sala-sistemas-2',     uid, nom, prog, hoy + 2, 14, 16, 30,  'Taller de programación',    'confirmada', false),
    ('auditorio-principal', uid, nom, prog, hoy + 3, 8, 10,  120, 'Conferencia de semilleros', 'pendiente',  true);
  insert into public.reservas (espacio_id, usuario_id, solicitante, programa, fecha, hora_inicio, hora_fin, asistentes, motivo, estado, necesita_aprobacion, llegada_confirmada, nota_estado) values
    ('lab-psicologia',  uid, nom, prog, hoy - 3, 14, 15, 20, 'Práctica clínica',  'asistio',    false, true,  null),
    ('auditorio-4piso', uid, nom, prog, hoy - 4, 9, 10,  40, 'Reunión de grupo',  'no_asistio', true,  false, 'Se liberó a las 9:15 am');
end $$;

-- Perfil automático al crear una cuenta en Supabase Auth.
-- Si el correo NO está en cuentas_autorizadas, la cuenta se rechaza.
create or replace function public.crear_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
declare c public.cuentas_autorizadas%rowtype;
begin
  select * into c from public.cuentas_autorizadas where email = lower(new.email);
  if not found then
    raise exception 'El correo % no está autorizado en CampuSpace', new.email;
  end if;
  insert into public.perfiles (id, email, nombre, rol, programa)
  values (new.id, c.email, c.nombre, c.rol, c.programa)
  on conflict (id) do nothing;
  if c.semilla then
    perform public.sembrar_reservas(new.id, c.nombre, c.programa);
  end if;
  return new;
end $$;

create trigger al_crear_usuario after insert on auth.users
  for each row execute function public.crear_perfil();

-- ------------------------------------------------------------
-- 6) Reglas de negocio EN EL SERVIDOR (no dependen del navegador)
--    - Al crear: estado y aprobación los decide el espacio, no el cliente.
--    - Al editar: quien reserva solo puede cancelar, confirmar su llegada o cerrar su reserva;
--      aprobar/rechazar y cambiar datos queda reservado al administrador.
--    Las operaciones sin sesión de usuario (SQL Editor, tareas programadas) no se restringen.
-- ------------------------------------------------------------
create or replace function public.validar_reserva() returns trigger
language plpgsql set search_path = public as $$
declare
  e public.espacios%rowtype;
  a public.ajustes%rowtype;
  p public.perfiles%rowtype;
  ahora_bog timestamp := now() at time zone 'America/Bogota';
  hoy date := (now() at time zone 'America/Bogota')::date;
  hora numeric := extract(hour from (now() at time zone 'America/Bogota')) + extract(minute from (now() at time zone 'America/Bogota')) / 60.0;
begin
  if auth.uid() is null then return new; end if;

  if tg_op = 'INSERT' then
    select * into e from public.espacios where id = new.espacio_id;
    if not found then raise exception 'El espacio no existe.'; end if;
    if e.estado <> 'activo' then raise exception 'Este espacio está en mantenimiento.'; end if;
    select * into a from public.ajustes where id = 1;
    select * into p from public.perfiles where id = auth.uid();
    if not found then raise exception 'Tu cuenta no tiene perfil en CampuSpace.'; end if;

    if new.hora_inicio < 7 or new.hora_fin > 19 then raise exception 'El campus abre de 7:00 am a 7:00 pm.'; end if;
    if new.hora_fin - new.hora_inicio > a.duracion_max then raise exception 'La duración máxima es de % horas.', a.duracion_max; end if;
    if new.fecha < hoy then raise exception 'No puedes reservar en una fecha pasada.'; end if;
    if new.fecha > hoy + a.anticipacion_dias then raise exception 'Solo puedes reservar con % días de anticipación.', a.anticipacion_dias; end if;
    if new.fecha = hoy and new.hora_inicio + a.liberar_min / 60.0 <= hora then raise exception 'Esa franja ya pasó.'; end if;
    if new.asistentes > e.capacidad then raise exception 'Supera la capacidad de la sala (% personas).', e.capacidad; end if;
    if new.motivo is null or btrim(new.motivo) = '' then raise exception 'Cuéntanos el motivo de la reserva.'; end if;

    -- Los datos del solicitante salen del perfil; el estado lo decide el espacio
    new.usuario_id := auth.uid();
    new.solicitante := p.nombre;
    new.programa := p.programa;
    new.necesita_aprobacion := e.requiere_aprobacion;
    new.estado := case when e.requiere_aprobacion then 'pendiente' else 'confirmada' end;
    new.llegada_confirmada := false;
    new.motivo_rechazo := null;
    new.nota_estado := null;
    new.es_ejemplo := false;
    new.creada := now();
    return new;
  end if;

  -- UPDATE
  if public.es_admin() then return new; end if;

  if new.espacio_id is distinct from old.espacio_id or new.usuario_id is distinct from old.usuario_id
     or new.solicitante is distinct from old.solicitante or new.programa is distinct from old.programa
     or new.fecha <> old.fecha or new.hora_inicio <> old.hora_inicio or new.hora_fin <> old.hora_fin
     or new.asistentes <> old.asistentes or new.motivo is distinct from old.motivo or new.notas is distinct from old.notas
     or new.necesita_aprobacion <> old.necesita_aprobacion or new.motivo_rechazo is distinct from old.motivo_rechazo
     or new.creada <> old.creada or new.es_ejemplo <> old.es_ejemplo then
    raise exception 'No puedes modificar los datos de la reserva.';
  end if;

  if new.estado <> old.estado and not (
       (old.estado in ('pendiente','confirmada') and new.estado = 'cancelada')
    or (old.estado = 'confirmada' and new.estado = 'no_asistio')
    or (old.estado = 'confirmada' and new.estado = 'asistio' and new.llegada_confirmada)
  ) then
    raise exception 'Ese cambio de estado no está permitido.';
  end if;

  if new.llegada_confirmada <> old.llegada_confirmada and not (new.llegada_confirmada and old.estado = 'confirmada') then
    raise exception 'No puedes cambiar la confirmación de llegada.';
  end if;
  return new;
end $$;

create trigger validar_reserva before insert or update on public.reservas
  for each row execute function public.validar_reserva();

-- ------------------------------------------------------------
-- 7) Seguridad (Row Level Security)
-- ------------------------------------------------------------
alter table public.cuentas_autorizadas enable row level security;   -- sin políticas: nadie la lee desde la web
alter table public.perfiles  enable row level security;
alter table public.espacios  enable row level security;
alter table public.reservas  enable row level security;
alter table public.ajustes   enable row level security;

create policy "perfil propio o admin"  on public.perfiles for select to authenticated
  using (id = auth.uid() or public.es_admin());

create policy "espacios visibles"      on public.espacios for select to authenticated using (true);
create policy "admin edita espacios"   on public.espacios for update to authenticated
  using (public.es_admin()) with check (public.es_admin());

create policy "reservas visibles"      on public.reservas for select to authenticated using (true);
create policy "crear reserva propia"   on public.reservas for insert to authenticated
  with check (usuario_id = auth.uid());
create policy "editar reserva propia o admin" on public.reservas for update to authenticated
  using (usuario_id = auth.uid() or public.es_admin())
  with check (usuario_id = auth.uid() or public.es_admin());

create policy "ajustes visibles"       on public.ajustes for select to authenticated using (true);
create policy "admin edita ajustes"    on public.ajustes for update to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Sin sesión (rol anon) no se puede leer ni escribir nada
revoke all on public.cuentas_autorizadas, public.perfiles, public.espacios, public.reservas, public.ajustes from anon;
-- Quien inició sesión no necesita borrar ni crear filas en estas tablas (las políticas ya lo restringen)
revoke delete, truncate on public.perfiles, public.espacios, public.reservas, public.ajustes from authenticated;
revoke all on public.cuentas_autorizadas from authenticated;

-- Las funciones internas NO se pueden llamar desde la web (API pública)
revoke all on function public.despejar(text, date, int, int) from public, anon, authenticated;
revoke all on function public.sembrar_reservas(uuid, text, text) from public, anon, authenticated;
revoke all on function public.crear_perfil() from public, anon, authenticated;
revoke all on function public.validar_reserva() from public, anon, authenticated;
revoke all on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated;

-- ------------------------------------------------------------
-- 8) Cuentas autorizadas
--    Para agregar a otra persona, inserta su correo aquí y luego créale la cuenta
--    en Authentication > Users (o pídele que use "Olvidé mi contraseña").
-- ------------------------------------------------------------
insert into public.cuentas_autorizadas (email, nombre, rol, programa, semilla) values
  ('estudiante@campusucc.edu.co', 'Daniel Gómez',      'estudiante',    'Derecho',        true),
  ('docente@campusucc.edu.co',    'Armando Rivera',    'docente',       'Derecho',        false),
  ('admin@campusucc.edu.co',      'Admin CampuSpace',  'administrador', 'Administración', false);

-- ------------------------------------------------------------
-- 9) Espacios del campus
-- ------------------------------------------------------------
insert into public.espacios (id, nombre, tipo, aula, ubicacion, capacidad, requiere_aprobacion, estado, equipos, normas) values
 ('sala-audiencias','Sala de audiencias','Sala','Aula 220','Facultad de Derecho · Bloque C, piso 1',40,true,'activo',
   array['Estrado','Mesas para las partes','40 sillas','Micrófonos','Proyector'],
   array['Requiere aprobación de un administrador','Confirma tu llegada en los primeros 15 minutos','Máximo 2 horas por reserva']),
 ('lab-fisica','Laboratorio de física','Laboratorio','Aula 220','Campus UCC · Aula 220',35,false,'activo',
   array['Generador Van de Graaff','Mesas','40 sillas','Carril de dinámica','Televisor','Kit de circuitos y medición'],
   array['Confirma tu llegada en los primeros 15 minutos','No consumas alimentos ni bebidas','Usa el generador de Van de Graaff solo con el docente','Deja los equipos ordenados al terminar']),
 ('lab-psicologia','Laboratorio de psicología','Laboratorio','Aula 219','Campus UCC · Aula 219',25,false,'activo',
   array['Microscopios','Mesones de laboratorio','30 sillas','Elementos de bioseguridad','Kit de muestras y tubos','Modelos anatómicos'],
   array['Confirma tu llegada en los primeros 15 minutos','Usa bata y guantes al manipular muestras','No consumas alimentos ni bebidas','Deja los implementos limpios y en su lugar']),
 ('camara-gesell','Cámara de Gesell','Sala','Aula 202','Campus UCC · Aula 202',8,true,'activo',
   array['Espejo unidireccional','Cámaras de video','Sala de observación','Micrófonos','Material lúdico','Sistema de audio'],
   array['Requiere aprobación de un administrador','Confirma tu llegada en los primeros 15 minutos','Guarda silencio en la sala de observación','No tomes fotos ni videos de las sesiones']),
 ('lab-contaduria','Laboratorio de Contaduría','Laboratorio','Aula 317','Campus UCC · Aula 219',30,false,'activo',
   array['Equipos de cómputo','Mesas','35 sillas','Software contable','Proyector'],
   array['Confirma tu llegada en los primeros 15 minutos','No consumas alimentos ni bebidas','No instales programas en los equipos','Desocupa el laboratorio al salir el docente']),
 ('sala-sistemas-2','Sala de sistemas 2','Sala','Aula 509','Campus UCC · Aula 509',32,false,'activo',
   array['Equipos de cómputo','Mesas','40 sillas','Cámara de vigilancia','Proyector'],
   array['Confirma tu llegada en los primeros 15 minutos','No consumas alimentos ni bebidas','No instales programas en los equipos','Desocupa la sala al salir el docente']),
 ('auditorio-principal','Auditorio principal','Auditorio','Auditorio principal','Campus UCC · Auditorio principal',200,true,'activo',
   array['Atril y escenario','Sistema de sonido','200 butacas','Micrófonos','Pantalla y proyector','Sillas para invitados'],
   array['Requiere aprobación de un administrador','Confirma tu llegada en los primeros 15 minutos','Solo puede usarse con la compañía de un docente','Deja el escenario y los equipos en orden']),
 ('auditorio-4piso','Auditorio 4 piso','Auditorio','Aula 401','Campus UCC · Aula especial 401',80,true,'activo',
   array['Atril y escenario','Sistema de sonido','80 butacas','Micrófonos','Pantalla y proyector','Mesas'],
   array['Requiere aprobación de un administrador','Confirma tu llegada en los primeros 15 minutos','Solo puede usarse con la compañía de un docente','Deja el escenario y los equipos en orden']),
 ('lab-redes','Laboratorio de redes','Laboratorio','Aula 508','Campus UCC · Aula 508',24,false,'mantenimiento',
   array['Equipos de cómputo','Mesas y sillas','Proyector','Routers','Switches','Cableado y herramientas'],
   array['Confirma tu llegada en los primeros 15 minutos','No desconectes equipos ni cables sin el docente','No instales programas en los equipos','Desocupa el laboratorio al salir el docente']),
 ('lab-enfermeria','Laboratorio de Enfermería','Laboratorio','Aula 215','Campus UCC · Aula 215',34,false,'activo',
   array['Camillas','Simuladores clínicos','40 sillas','Insumos médicos','Elementos de bioseguridad','Lavamanos y aseo'],
   array['Confirma tu llegada en los primeros 15 minutos','Usa uniforme y elementos de bioseguridad','Lávate las manos antes y después de la práctica','Desocupa el laboratorio al salir el docente']);


-- ------------------------------------------------------------
-- 10) Datos de ejemplo (reservas de otras personas + historial para la analítica)
-- ------------------------------------------------------------
-- Genera reservas de ejemplo para los días del rango que todavía no tienen:
--   hoy y futuro  -> reservas confirmadas (~24 % de las franjas)
--   días pasados  -> historial de asistencias e inasistencias (~30 % de las franjas)
create or replace function public.generar_ejemplos(desde date, hasta date) returns void
language plpgsql security definer set search_path = public as $$
declare
  hoy date := public.hoy_bogota();
  f date; e record; h int; fallo boolean;
begin
  for f in select d::date from generate_series(desde, hasta, interval '1 day') as d loop
    continue when exists (select 1 from public.reservas where es_ejemplo and fecha = f);
    for e in select id from public.espacios where estado = 'activo' loop
      for h in 7..17 loop
        begin
          if f >= hoy then
            if abs(hashtext(e.id || (f - hoy)::text || '|' || h)::bigint) % 100 < 24 then
              insert into public.reservas (espacio_id, solicitante, programa, fecha, hora_inicio, hora_fin, asistentes, motivo, estado, es_ejemplo)
              values (e.id, 'Reserva de ejemplo', 'Campus UCC', f, h, h + 1, 10, 'Clase programada', 'confirmada', true);
            end if;
          elsif abs(hashtext('p' || e.id || (hoy - f)::text || '|' || h)::bigint) % 100 < 30 then
            fallo := abs(hashtext('f' || e.id || (hoy - f)::text || h)::bigint) % 100 < 14;
            insert into public.reservas (espacio_id, solicitante, programa, fecha, hora_inicio, hora_fin, asistentes, motivo, estado, llegada_confirmada, es_ejemplo)
            values (e.id, 'Reserva de ejemplo', 'Campus UCC', f, h, h + 1, 10, 'Clase programada',
                    case when fallo then 'no_asistio' else 'asistio' end, not fallo, true);
          end if;
        exception when exclusion_violation then null;
        end;
      end loop;
    end loop;
  end loop;
end $$;

-- Mantiene la demostración "viva": cada día agrega el día nuevo, cierra los días ya pasados
-- (asistió / no asistió) y borra el historial muy viejo. No toca reservas de personas reales.
create or replace function public.avanzar_ejemplos() returns void
language plpgsql security definer set search_path = public as $$
declare hoy date := public.hoy_bogota();
begin
  perform public.generar_ejemplos(hoy - 28, hoy + 6);
  update public.reservas set
    estado = case when abs(hashtext('c' || id::text)::bigint) % 100 < 14 then 'no_asistio' else 'asistio' end,
    llegada_confirmada = abs(hashtext('c' || id::text)::bigint) % 100 >= 14
  where es_ejemplo and solicitante = 'Reserva de ejemplo' and estado = 'confirmada' and fecha < hoy;
  delete from public.reservas where es_ejemplo and fecha < hoy - 60;
end $$;

-- Deja la base como nueva: borra TODAS las reservas y carga los ejemplos.
-- p_hora = hora (7 a 17) en la que se verán los 5 estados del mapa; por defecto, la hora actual.
--   select public.reiniciar_demo();      -- ahora
--   select public.reiniciar_demo(15);    -- como si fueran las 3 pm
create or replace function public.reiniciar_demo(p_hora int default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  hoy date := public.hoy_bogota();
  ahora numeric := extract(hour from (now() at time zone 'America/Bogota')) + extract(minute from (now() at time zone 'America/Bogota')) / 60.0;
  hd int; p record;
begin
  delete from public.reservas;
  hd := coalesce(p_hora, case when ahora < 7 or ahora >= 18.75 then 9 else least(17, floor(ahora)::int) end);
  hd := least(17, greatest(7, hd));

  perform public.generar_ejemplos(hoy - 28, hoy + 6);

  -- A la hora hd el mapa muestra: audiencias Pendiente, enfermería Ocupado, auditorio Reservado pronto,
  -- redes En mantenimiento y los demás espacios Disponibles.
  delete from public.reservas where es_ejemplo and solicitante = 'Reserva de ejemplo' and fecha = hoy and hora_inicio <= hd + 1 and hd < hora_fin;
  perform public.despejar('camara-gesell', hoy + 1, 9, 11);
  perform public.despejar('auditorio-principal', hoy + 4, 14, 16);
  perform public.despejar('auditorio-4piso', hoy + 5, 8, 10);
  perform public.despejar('lab-contaduria', hoy + 2, 10, 12);

  insert into public.reservas (espacio_id, solicitante, programa, fecha, hora_inicio, hora_fin, asistentes, motivo, estado, necesita_aprobacion, motivo_rechazo, creada, es_ejemplo) values
    ('sala-audiencias',     'Ana Pérez',      'Derecho',          hoy,     hd,     hd + 1, 20,  'Simulación de audiencia',        'pendiente',  true,  null, now() - interval '2 hours', true),
    ('lab-enfermeria',      'Sofía Ramírez',  'Enfermería',       hoy,     hd,     hd + 1, 28,  'Práctica de signos vitales',     'confirmada', false, null, now() - interval '1 day',   true),
    ('auditorio-principal', 'Carlos Ruiz',    'Admin de empresas',hoy,     hd + 1, hd + 2, 120, 'Ensayo de grado',                'confirmada', true,  null, now() - interval '1 day',   true),
    ('camara-gesell',       'Laura Gómez',    'Psicología',       hoy + 1, 9,      11,     6,   'Práctica de entrevista clínica', 'pendiente',  true,  null, now() - interval '5 hours', true),
    ('auditorio-principal', 'Carlos Ruiz',    'Admin de empresas',hoy + 4, 14,     16,     120, 'Conferencia de semilleros',      'pendiente',  true,  null, now() - interval '1 day',   true),
    ('auditorio-4piso',     'María Torres',   'Enfermería',       hoy + 5, 8,      10,     60,  'Charla de bioseguridad',         'confirmada', true,  null, now() - interval '2 days',  true),
    ('lab-contaduria',      'Pedro Salazar',  'Contaduría',       hoy + 2, 10,     12,     80,  'Evento externo',                 'rechazada',  false, 'El laboratorio tiene capacidad para 30 personas.', now() - interval '3 days', true);

  -- reservas propias de la cuenta de estudiante de demostración
  for p in select pf.id, pf.nombre, pf.programa from public.perfiles pf
           join public.cuentas_autorizadas c on c.email = pf.email where c.semilla loop
    perform public.sembrar_reservas(p.id, p.nombre, p.programa);
  end loop;
end $$;

revoke all on function public.generar_ejemplos(date, date) from public, anon, authenticated;
revoke all on function public.avanzar_ejemplos() from public, anon, authenticated;
revoke all on function public.reiniciar_demo(int) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 11) Cuentas de acceso (se crean aquí para no tener que hacerlo a mano)
--     Si tu proyecto no permite crearlas por SQL, el script sigue y las creas
--     en Authentication > Users > Add user (marca Auto Confirm User).
-- ------------------------------------------------------------
do $$
declare u record; uid uuid;
begin
  for u in select * from (values
      ('estudiante@campusucc.edu.co', 'Campus2026*'),
      ('docente@campusucc.edu.co',    'Campus2026*'),
      ('admin@campusucc.edu.co',      'Admin2026*')) as t(email, pass)
  loop
    continue when exists (select 1 from auth.users where lower(email) = u.email);
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change, email_change_token_new)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', u.email,
            extensions.crypt(u.pass, extensions.gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid, uid::text,
            jsonb_build_object('sub', uid::text, 'email', u.email, 'email_verified', true),
            'email', now(), now(), now());
  end loop;
exception when others then
  raise notice 'No se pudieron crear las cuentas por SQL (%). Créalas en Authentication > Users.', sqlerrm;
end $$;

-- Si las cuentas ya existían (al volver a ejecutar este archivo), se les reconstruye el perfil
insert into public.perfiles (id, email, nombre, rol, programa)
select u.id, c.email, c.nombre, c.rol, c.programa
from auth.users u join public.cuentas_autorizadas c on c.email = lower(u.email)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 12) Cargar los datos de ejemplo
-- ------------------------------------------------------------
select public.reiniciar_demo();

-- ------------------------------------------------------------
-- 13) Tarea diaria (opcional): mantiene la demostración con fechas de hoy en adelante.
--     Necesita la extensión pg_cron (Database > Extensions). Si no está, se omite sin error;
--     en ese caso ejecuta  select public.avanzar_ejemplos();  cuando quieras renovar los días.
-- ------------------------------------------------------------
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'campuspace-avanzar-ejemplos';
  perform cron.schedule('campuspace-avanzar-ejemplos', '0 8 * * *', 'select public.avanzar_ejemplos()');  -- 3:00 am Colombia
exception when others then
  raise notice 'pg_cron no disponible (%): la tarea diaria se omitió.', sqlerrm;
end $$;
