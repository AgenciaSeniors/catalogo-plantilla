-- =====================================================================
-- MIGRATION v4 — Galería multi-foto por producto
--
-- Añade soporte para que cada producto tenga hasta 5 imágenes (carrusel
-- en el modal de detalle del catálogo público).
--
-- La columna `imagen_url` (singular) se mantiene por compatibilidad y
-- siempre refleja la PRIMERA imagen del array (la "principal" usada en
-- las cards del grid).
--
-- Ejecutar UNA SOLA VEZ en el SQL Editor de Supabase.
-- =====================================================================

alter table catalogo_productos
    add column if not exists imagenes_url jsonb default '[]'::jsonb;

-- Para productos existentes con `imagen_url` ya seteado, migrar al array
update catalogo_productos
    set imagenes_url = jsonb_build_array(imagen_url)
    where imagen_url is not null
    and imagen_url != ''
    and (imagenes_url is null or imagenes_url = '[]'::jsonb);

-- Estructura del JSON:
--   ["url1", "url2", "url3"]
--
-- Convención: el primer elemento es la imagen "principal" (la que se
-- muestra en la card del grid y en `imagen_url` para compatibilidad).
