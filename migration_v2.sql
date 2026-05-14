-- =====================================================================
-- MIGRATION v2 — Promociones, Stock, Horario estructurado
-- Ejecutar UNA SOLA VEZ en el SQL Editor de Supabase para añadir
-- las nuevas columnas a las tablas que ya existen.
-- Seguro de correr más de una vez (usa "if not exists").
-- =====================================================================

-- Promociones (precio anterior tachado + flag de oferta)
alter table catalogo_productos
    add column if not exists precio_anterior numeric(12,2),
    add column if not exists en_oferta boolean default false;

-- Stock numérico opcional (para mostrar "Solo quedan X")
alter table catalogo_productos
    add column if not exists stock integer;

-- Horario estructurado (7 días) — para detectar "Abierto ahora"
-- Estructura esperada:
-- {
--   "lun": { "abierto": true,  "apertura": "09:00", "cierre": "18:00" },
--   "mar": { "abierto": true,  "apertura": "09:00", "cierre": "18:00" },
--   ...
--   "dom": { "abierto": false, "apertura": "",      "cierre": ""      }
-- }
alter table catalogo_negocios
    add column if not exists horario_semanal jsonb;
