// ============================================================
// Configuración de CampuSpace
// 1) Crea tu proyecto en https://supabase.com (gratis).
// 2) En Project Settings > API copia "Project URL" y la clave "anon public".
// 3) Pégalas aquí abajo. Si las dejas vacías, la web funciona en MODO DEMOSTRACIÓN
//    (los datos se guardan solo en tu navegador, sin servidor).
// ============================================================
window.CS_CONFIG = {
  SUPABASE_URL: "https://fsavikouzxbptpfzqqso.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzYXZpa291enhicHRwZnpxcXNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQzNTg5MzEsImV4cCI6MjEwOTkzNDkzMX0.0sHasf5ixWf2C9bST0PO6gYlOFUlexfo0-zjUu-0DYU",

  // Muestra, en la pantalla de login, las cuentas de prueba para quien evalúa el proyecto.
  MOSTRAR_CUENTAS_DEMO: true,

  // Para presentaciones: permite pulsar "Confirmar llegada" en cualquier reserva confirmada
  // de hoy o de días futuros. Ponlo en false para exigir la ventana real (desde 1 hora
  // antes del inicio hasta 15 minutos después).
  DEMO_CONFIRMAR_LLEGADA_SIEMPRE: true
};
