# CampuSpace · MVP

Sistema web de reserva de espacios universitarios (salas, laboratorios y auditorios).
Estudiantes y docentes consultan la disponibilidad y reservan; los administradores aprueban
solicitudes, revisan la analítica y configuran las reglas.

## Tecnologías

| Capa | Tecnología |
|---|---|
| Interfaz | HTML, CSS y JavaScript (sin frameworks ni compilación) |
| Base de datos y login | Supabase (PostgreSQL + Supabase Auth + Row Level Security) |
| Publicación | Hosting estático gratuito (Netlify, GitHub Pages o Vercel) |

## Estructura

```
index.html            Página única (la app se dibuja con JavaScript)
css/styles.css        Estilos
js/config.js          URL y clave de Supabase (aquí se conecta la base de datos)
js/api.js             Capa de datos: Supabase o modo demostración
js/ui.js              Utilidades de interfaz
js/views1.js          Login, mapa, espacios, ficha, confirmar y reserva confirmada
js/views2.js          Mis reservas, solicitudes, analítica y configuración
js/app.js             Navegación y eventos
supabase/schema.sql   Tablas, reglas de seguridad y datos de ejemplo
```

## Dos formas de usarlo

**Modo demostración (sin servidor).** Si `js/config.js` tiene las claves vacías, la web funciona
sola y guarda los datos en el navegador. Sirve para probarla ya: abre `index.html`.

**Modo real (con base de datos).** Se activa al pegar las claves de Supabase. Es el que debes
desplegar para que el profesor entre desde cualquier lugar.

## Despliegue paso a paso

### 1) Crear la base de datos en Supabase (10 min)

1. Entra a https://supabase.com, crea una cuenta gratuita y pulsa **New project**.
   Ponle un nombre (por ejemplo `campuspace`), una contraseña de base de datos y la región más cercana.
2. Cuando termine de crearse, abre **SQL Editor → New query**, pega **todo** el contenido de
   `supabase/schema.sql` y pulsa **Run**. Debe terminar con "Success". En ese único paso se crean:
   las tablas, las reglas de seguridad, las validaciones del servidor, los 10 espacios, **las 3
   cuentas de acceso con su contraseña** y las reservas de ejemplo (incluido el historial para la
   analítica).

   | Correo | Contraseña | Rol |
   |---|---|---|
   | estudiante@campusucc.edu.co | Campus2026* | Estudiante (trae reservas de ejemplo) |
   | docente@campusucc.edu.co | Campus2026* | Docente |
   | admin@campusucc.edu.co | Admin2026* | Administrador |

   Si al final aparece un aviso "No se pudieron crear las cuentas por SQL", créalas a mano en
   **Authentication → Users → Add user → Create new user** (marca **Auto Confirm User**) con los
   mismos correos y contraseñas; el perfil y los datos se enlazan solos.
3. Ve a **Authentication → Sign In / Providers → Email** y desactiva **Allow new users to sign up**.
   Así nadie se puede registrar: solo existen las cuentas que tú creas. (Aun si lo dejas activo,
   la base rechaza cualquier correo que no esté en `cuentas_autorizadas`.)
4. Para agregar a otra persona: primero autoriza su correo y luego créale la cuenta en
   **Authentication → Users**:

   ```sql
   insert into public.cuentas_autorizadas (email, nombre, rol, programa)
   values ('maria@campusucc.edu.co', 'María Torres', 'estudiante', 'Enfermería');
   ```

5. **Reiniciar o renovar los datos de ejemplo** (útil antes de presentar):

   ```sql
   select public.reiniciar_demo();     -- borra TODAS las reservas y recarga los ejemplos
   select public.reiniciar_demo(15);   -- igual, pero el mapa muestra sus 5 estados como a las 3 pm
   select public.avanzar_ejemplos();   -- solo agrega los días nuevos, sin borrar nada
   ```

   Si la extensión `pg_cron` está disponible, el script ya programa `avanzar_ejemplos()` cada día
   (3:00 am hora de Colombia) para que el calendario nunca quede sin fechas futuras.

### 2) Conectar la web con Supabase (2 min)

1. En Supabase abre **Project Settings → API**.
2. Copia **Project URL** y la clave **anon public**.
3. Abre `js/config.js` y pégalas:

   ```js
   SUPABASE_URL: "https://xxxxxxxx.supabase.co",
   SUPABASE_ANON_KEY: "eyJhbGciOi...",
   ```

   La clave `anon` es pública por diseño: la protección real la dan las reglas de seguridad
   (Row Level Security) del `schema.sql`. **Nunca** pegues la clave `service_role`.

### 3) Publicar la web (5 min)

**Opción A: Netlify (la más simple).**
1. Entra a https://app.netlify.com/drop e inicia sesión.
2. Arrastra la carpeta completa del proyecto (la que contiene `index.html`).
3. Netlify te da un enlace público como `https://algo-aleatorio.netlify.app`. Puedes cambiarle el nombre en *Site configuration*.

**Opción B: GitHub Pages.**
1. Crea un repositorio y sube todos los archivos del proyecto.
2. En **Settings → Pages**, elige la rama `main` y la carpeta `/ (root)`.
3. El enlace queda como `https://tu-usuario.github.io/nombre-del-repo/`.

Después de publicar, abre el enlace, inicia sesión con una cuenta de prueba y revisa que el pie de
página **no** diga "Modo demostración". Si lo dice, las claves de `config.js` están vacías o mal pegadas.

## Qué puede hacer cada rol

| Rol | Puede |
|---|---|
| Estudiante y docente | Iniciar sesión, ver el mapa y la lista de espacios, abrir la ficha, reservar una franja (hasta 2 horas), pedir aprobación en espacios restringidos, ver sus reservas, confirmar llegada, reprogramar y cancelar |
| Administrador | Todo lo anterior, más: aprobar o rechazar solicitudes con motivo, ver la analítica y configurar capacidad, aprobación, mantenimiento y reglas de reserva |

## Reglas de negocio implementadas

Las reglas se validan en la web **y también en la base de datos** (un trigger), así que no se pueden saltar desde otra herramienta.

- Una franja no se puede reservar dos veces: la base de datos lo impide con una restricción de exclusión.
- Si otra persona toma la franja mientras decides, se muestra "Esta franja ya no está disponible".
- No se puede superar la capacidad del espacio, ni la duración máxima, ni reservar en el pasado o más allá del límite de anticipación.
- Los espacios que requieren aprobación dejan la reserva en "Pendiente" hasta que un administrador la apruebe o rechace.
- Si no se confirma la llegada dentro del plazo (15 min por defecto), la reserva se marca "No asistió" y el espacio se libera.
- Los espacios en mantenimiento no se pueden reservar.

## Para presentar el proyecto

- **Confirmar llegada:** por defecto el botón se puede pulsar en cualquier reserva confirmada de
  hoy o futura (`DEMO_CONFIRMAR_LLEGADA_SIEMPRE: true` en `config.js`). Ponlo en `false` para exigir
  la ventana real (desde 1 hora antes hasta 15 minutos después del inicio).
- **Fotos de los espacios:** hoy cada espacio muestra una ilustración. Para usar fotos reales,
  sube las imágenes a la carpeta `img/` y actualiza la columna `imagen` de la tabla `espacios`
  (por ejemplo `update public.espacios set imagen = 'img/auditorio.jpg' where id = 'auditorio-principal';`).
- **Ocultar las cuentas de prueba** del login: `MOSTRAR_CUENTAS_DEMO: false` en `config.js`.

## Límites conocidos de este MVP

- Los avisos a los solicitantes ("Le avisamos a…") son mensajes en pantalla; no se envían correos.
- Quien reserva solo puede cancelar, confirmar su llegada o cerrar su reserva (lo impone la base);
  aprobar, rechazar y editar datos queda para el administrador. El paso a "No asistió" lo ejecuta
  la web cuando el usuario abre Mis reservas, no un proceso del servidor.
- La analítica se calcula en el navegador con los datos de los últimos 45 días.
