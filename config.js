// =====================================================================
// CONFIGURACIÓN POR CLIENTE
// =====================================================================
// Este es el ÚNICO archivo que cambia entre cliente y cliente.
// Pasos:
//   1. SUPABASE_URL y SUPABASE_KEY: misma para todos los clientes
//      (las copias UNA vez desde Supabase > Settings > API).
//   2. BUSINESS_ID: el UUID que devuelve la función catalogo_crear_negocio()
//      al dar de alta al cliente en Supabase.
// =====================================================================

const CONFIG = {
    SUPABASE_URL: 'https://xwkmhpcombsauoozyidi.supabase.co',
    SUPABASE_KEY: 'sb_publishable_5iDJi-xK69y1DM0nFYjqlw_TaozemSt',
    BUSINESS_ID: '919d01af-1055-475e-bd01-fa16ab9490fd'
};

const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
