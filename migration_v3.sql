-- =====================================================================
-- MIGRATION v3 — Sistema de monedas múltiples
--
-- Añade soporte para que cada negocio defina su moneda base + monedas
-- adicionales con tasas de cambio. El cliente final puede ver los precios
-- convertidos en vivo desde el catálogo.
--
-- Ejecutar UNA SOLA VEZ en el SQL Editor de Supabase.
-- =====================================================================

alter table catalogo_negocios
    add column if not exists monedas jsonb
    default '{"base": "CUP", "activas": ["CUP"], "tasas": {}}'::jsonb;

-- Para negocios existentes que tengan monedas null, asignarles default
update catalogo_negocios
    set monedas = '{"base": "CUP", "activas": ["CUP"], "tasas": {}}'::jsonb
    where monedas is null;

-- Estructura del JSON:
--   {
--     "base": "CUP",              <- moneda en la que el dueño escribe los precios
--     "activas": ["CUP","USD"],   <- monedas seleccionables desde el catálogo
--     "tasas": {                  <- cuántas unidades de "base" equivalen a 1 unidad
--       "USD": 350,               <-   1 USD = 350 CUP
--       "EUR": 380                <-   1 EUR = 380 CUP
--     }
--   }
