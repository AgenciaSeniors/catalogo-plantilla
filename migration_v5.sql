-- =====================================================================
-- MIGRATION v5 — Estadísticas del catálogo
--
-- Añade una tabla de eventos para registrar la actividad del catálogo
-- (visitas, productos vistos, pedidos por WhatsApp) y una función que
-- devuelve las estadísticas agregadas para el panel gerencial.
--
-- Ejecutar UNA SOLA VEZ en el SQL Editor de Supabase.
-- =====================================================================

-- 1. TABLA DE EVENTOS
create table if not exists catalogo_eventos (
    id bigserial primary key,
    negocio_id uuid not null references catalogo_negocios(id) on delete cascade,
    tipo text not null,                       -- 'vista_catalogo' | 'vista_producto' | 'pedido_whatsapp'
    producto_id bigint references catalogo_productos(id) on delete set null,
    creado_en timestamptz default now()
);

create index if not exists idx_cat_eventos_negocio on catalogo_eventos(negocio_id, tipo);
create index if not exists idx_cat_eventos_fecha on catalogo_eventos(creado_en);

-- 2. RLS
alter table catalogo_eventos enable row level security;

-- Cualquiera (público) puede INSERTAR eventos — el catálogo registra visitas
drop policy if exists "cat_public_inserta_eventos" on catalogo_eventos;
create policy "cat_public_inserta_eventos" on catalogo_eventos for insert with check (true);

-- Solo el dueño puede LEER los eventos de su negocio
drop policy if exists "cat_owner_lee_eventos" on catalogo_eventos;
create policy "cat_owner_lee_eventos" on catalogo_eventos for select
    using (negocio_id in (select negocio_id from catalogo_usuarios_negocio where user_id = auth.uid()));

-- 3. FUNCIÓN DE ESTADÍSTICAS AGREGADAS
-- Devuelve un JSON con todos los números para el panel.
-- security definer + chequeo de dueño = seguro y eficiente.
create or replace function catalogo_estadisticas(p_negocio_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_resultado jsonb;
begin
    -- Verificar que quien llama es dueño de ese negocio
    if not exists (
        select 1 from catalogo_usuarios_negocio
        where user_id = auth.uid() and negocio_id = p_negocio_id
    ) then
        raise exception 'No autorizado';
    end if;

    select jsonb_build_object(
        'visitas_total', (
            select count(*) from catalogo_eventos
            where negocio_id = p_negocio_id and tipo = 'vista_catalogo'
        ),
        'visitas_semana', (
            select count(*) from catalogo_eventos
            where negocio_id = p_negocio_id and tipo = 'vista_catalogo'
              and creado_en > now() - interval '7 days'
        ),
        'pedidos_total', (
            select count(*) from catalogo_eventos
            where negocio_id = p_negocio_id and tipo = 'pedido_whatsapp'
        ),
        'pedidos_semana', (
            select count(*) from catalogo_eventos
            where negocio_id = p_negocio_id and tipo = 'pedido_whatsapp'
              and creado_en > now() - interval '7 days'
        ),
        'vistas_producto_total', (
            select count(*) from catalogo_eventos
            where negocio_id = p_negocio_id and tipo = 'vista_producto'
        ),
        'top_productos', (
            select coalesce(jsonb_agg(t), '[]'::jsonb) from (
                select e.producto_id, p.nombre, count(*)::int as vistas
                from catalogo_eventos e
                join catalogo_productos p on p.id = e.producto_id
                where e.negocio_id = p_negocio_id and e.tipo = 'vista_producto'
                group by e.producto_id, p.nombre
                order by vistas desc
                limit 5
            ) t
        ),
        'opiniones_total', (
            select count(*) from catalogo_opiniones where negocio_id = p_negocio_id
        ),
        'opiniones_promedio', (
            select coalesce(round(avg(puntuacion), 1), 0)
            from catalogo_opiniones where negocio_id = p_negocio_id
        )
    ) into v_resultado;

    return v_resultado;
end;
$$;

-- =====================================================================
-- FIN MIGRATION v5
-- =====================================================================
