-- =====================================================================
-- CATÁLOGO DIGITAL - PLANTILLA AGENCY SENIORS
-- Schema multi-negocio para Supabase
--
-- IMPORTANTE: TODAS las tablas, el bucket y la función llevan el prefijo
-- "catalogo_" para coexistir sin conflictos con otros proyectos que ya
-- tengan tablas como "productos", "opiniones", "restaurantes", etc.
--
-- Ejecutar UNA SOLA VEZ en el SQL Editor de Supabase.
-- =====================================================================

-- 1. TABLA NEGOCIOS (identidad e info de cada cliente)
create table if not exists catalogo_negocios (
    id uuid primary key default gen_random_uuid(),
    nombre text not null default 'Mi Negocio',
    descripcion text default '',
    logo_url text,
    portada_url text,
    horario text default '',                  -- texto libre (compatibilidad y notas especiales)
    horario_semanal jsonb,                    -- estructurado por día (para "Abierto/Cerrado")
    telefono text default '',
    whatsapp text default '',
    direccion text default '',
    instagram text default '',
    facebook text default '',
    color_acento text default '#2ECC71',
    opiniones_activas boolean default true,
    creado_en timestamptz default now()
);

-- 2. TABLA CATEGORÍAS (cada negocio crea las suyas)
create table if not exists catalogo_categorias (
    id bigserial primary key,
    negocio_id uuid not null references catalogo_negocios(id) on delete cascade,
    nombre text not null,
    icono text default '🏷️',
    orden int default 0,
    activo boolean default true,
    creado_en timestamptz default now()
);

create index if not exists idx_cat_categorias_negocio on catalogo_categorias(negocio_id);

-- 3. TABLA PRODUCTOS
create table if not exists catalogo_productos (
    id bigserial primary key,
    negocio_id uuid not null references catalogo_negocios(id) on delete cascade,
    categoria_id bigint references catalogo_categorias(id) on delete set null,
    nombre text not null,
    descripcion text default '',
    precio numeric(12,2) default 0,
    precio_anterior numeric(12,2),            -- precio antes de la oferta (tachado en UI)
    en_oferta boolean default false,          -- toggle para activar la oferta
    stock integer,                            -- nullable; si está, se muestra "Solo quedan X"
    imagen_url text,
    destacado boolean default false,
    estado text default 'disponible',         -- 'disponible' | 'agotado' (legacy/binario)
    activo boolean default true,
    creado_en timestamptz default now()
);

create index if not exists idx_cat_productos_negocio on catalogo_productos(negocio_id);
create index if not exists idx_cat_productos_categoria on catalogo_productos(categoria_id);

-- 4. TABLA OPINIONES
create table if not exists catalogo_opiniones (
    id bigserial primary key,
    negocio_id uuid not null references catalogo_negocios(id) on delete cascade,
    producto_id bigint not null references catalogo_productos(id) on delete cascade,
    cliente_nombre text default 'Anónimo',
    comentario text default '',
    puntuacion int not null check (puntuacion between 1 and 5),
    creado_en timestamptz default now()
);

create index if not exists idx_cat_opiniones_producto on catalogo_opiniones(producto_id);

-- 5. TABLA PUENTE USUARIO ↔ NEGOCIO
-- Vincula un usuario de Supabase Auth con el negocio que administra
create table if not exists catalogo_usuarios_negocio (
    user_id uuid primary key references auth.users(id) on delete cascade,
    negocio_id uuid not null references catalogo_negocios(id) on delete cascade,
    rol text default 'admin',
    creado_en timestamptz default now()
);

-- =====================================================================
-- ROW LEVEL SECURITY (RLS) - Seguridad multi-tenant
-- Solo se activa en MIS tablas; las tablas de los menús de restaurantes
-- quedan intactas.
-- =====================================================================

alter table catalogo_negocios enable row level security;
alter table catalogo_categorias enable row level security;
alter table catalogo_productos enable row level security;
alter table catalogo_opiniones enable row level security;
alter table catalogo_usuarios_negocio enable row level security;

-- LECTURA PÚBLICA (cualquiera puede ver el catálogo)
drop policy if exists "cat_public_lee_negocios" on catalogo_negocios;
create policy "cat_public_lee_negocios" on catalogo_negocios for select using (true);

drop policy if exists "cat_public_lee_categorias" on catalogo_categorias;
create policy "cat_public_lee_categorias" on catalogo_categorias for select using (activo = true);

drop policy if exists "cat_public_lee_productos" on catalogo_productos;
create policy "cat_public_lee_productos" on catalogo_productos for select using (activo = true);

drop policy if exists "cat_public_lee_opiniones" on catalogo_opiniones;
create policy "cat_public_lee_opiniones" on catalogo_opiniones for select using (true);

-- INSERCIÓN PÚBLICA DE OPINIONES (clientes finales pueden dejar reseñas)
drop policy if exists "cat_public_inserta_opiniones" on catalogo_opiniones;
create policy "cat_public_inserta_opiniones" on catalogo_opiniones for insert with check (true);

-- ESCRITURA RESTRINGIDA: solo el dueño del negocio puede modificar lo suyo
drop policy if exists "cat_owner_edita_negocio" on catalogo_negocios;
create policy "cat_owner_edita_negocio" on catalogo_negocios for update
    using (id in (select negocio_id from catalogo_usuarios_negocio where user_id = auth.uid()));

drop policy if exists "cat_owner_gestiona_categorias" on catalogo_categorias;
create policy "cat_owner_gestiona_categorias" on catalogo_categorias for all
    using (negocio_id in (select negocio_id from catalogo_usuarios_negocio where user_id = auth.uid()))
    with check (negocio_id in (select negocio_id from catalogo_usuarios_negocio where user_id = auth.uid()));

drop policy if exists "cat_owner_gestiona_productos" on catalogo_productos;
create policy "cat_owner_gestiona_productos" on catalogo_productos for all
    using (negocio_id in (select negocio_id from catalogo_usuarios_negocio where user_id = auth.uid()))
    with check (negocio_id in (select negocio_id from catalogo_usuarios_negocio where user_id = auth.uid()));

drop policy if exists "cat_owner_elimina_opiniones" on catalogo_opiniones;
create policy "cat_owner_elimina_opiniones" on catalogo_opiniones for delete
    using (negocio_id in (select negocio_id from catalogo_usuarios_negocio where user_id = auth.uid()));

drop policy if exists "cat_owner_ve_vinculo" on catalogo_usuarios_negocio;
create policy "cat_owner_ve_vinculo" on catalogo_usuarios_negocio for select
    using (user_id = auth.uid());

-- =====================================================================
-- STORAGE BUCKET ESPECÍFICO PARA EL CATÁLOGO
-- Bucket separado del que usan los menús de restaurantes para mantener
-- todo organizado.
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('catalogo_imagenes', 'catalogo_imagenes', true)
on conflict (id) do nothing;

-- Public puede leer imágenes del catálogo
drop policy if exists "cat_public_lee_imagenes" on storage.objects;
create policy "cat_public_lee_imagenes" on storage.objects for select
    using (bucket_id = 'catalogo_imagenes');

-- Cualquier autenticado puede subir al bucket del catálogo
drop policy if exists "cat_auth_sube_imagenes" on storage.objects;
create policy "cat_auth_sube_imagenes" on storage.objects for insert
    with check (bucket_id = 'catalogo_imagenes' and auth.role() = 'authenticated');

-- Auth puede actualizar/eliminar imágenes del bucket del catálogo
drop policy if exists "cat_auth_gestiona_imagenes" on storage.objects;
create policy "cat_auth_gestiona_imagenes" on storage.objects for all
    using (bucket_id = 'catalogo_imagenes' and auth.role() = 'authenticated');

-- =====================================================================
-- FUNCIÓN HELPER: alta de nuevo cliente (negocio + usuario)
-- Llamar desde el SQL Editor cuando entres un nuevo cliente.
-- Devuelve el UUID del negocio para pegarlo en config.js
-- =====================================================================

create or replace function catalogo_crear_negocio(
    p_user_id uuid,
    p_nombre text default 'Mi Negocio'
)
returns uuid
language plpgsql
security definer
as $$
declare
    v_negocio_id uuid;
begin
    insert into catalogo_negocios (nombre) values (p_nombre)
    returning id into v_negocio_id;

    insert into catalogo_usuarios_negocio (user_id, negocio_id)
    values (p_user_id, v_negocio_id);

    return v_negocio_id;
end;
$$;

-- =====================================================================
-- FIN DEL SCHEMA
-- =====================================================================
