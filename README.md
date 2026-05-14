# Catálogo Digital — Plantilla AGENCY SENIORS

Plantilla genérica de catálogo digital para pequeños negocios. Multi-tenant: un solo Supabase atiende a todos los clientes; cada negocio se identifica por su `BUSINESS_ID`.

## ⚠️ Coexistencia con otros proyectos

**Diseñado para compartir el mismo proyecto Supabase con tus menús digitales de restaurantes (La Casona, etc.) sin romper nada.**

Todas las tablas, el bucket de storage y la función helper llevan el prefijo `catalogo_`:

| Recurso | Nombre |
|---|---|
| Tabla negocios | `catalogo_negocios` |
| Tabla categorías | `catalogo_categorias` |
| Tabla productos | `catalogo_productos` |
| Tabla opiniones | `catalogo_opiniones` |
| Tabla puente usuarios | `catalogo_usuarios_negocio` |
| Storage bucket | `catalogo_imagenes` |
| Función helper | `catalogo_crear_negocio()` |

Tus tablas existentes de menús (`productos`, `opiniones`, etc. de La Casona y otros restaurantes) **quedan intactas**. RLS solo se activa en las nuevas tablas con prefijo `catalogo_`.

---

## Estructura de archivos

```
plantilla/
├── index.html        # Catálogo público (lo que ven los clientes finales)
├── style.css
├── modal.css
├── script.js
├── login.html        # Acceso al panel
├── admin.html        # Panel gerencial
├── admin.js
├── config.js         # ÚNICO archivo a editar por cliente
└── schema.sql        # Esquema Supabase (correr UNA SOLA vez)
```

---

## SETUP INICIAL DE LA AGENCIA (una sola vez)

1. **Cargar el schema en tu Supabase actual** (el mismo de los menús)
   - Abrir el SQL Editor en Supabase
   - Pegar TODO el contenido de `schema.sql`
   - Ejecutar (botón "Run"). Esto crea las 5 tablas con prefijo `catalogo_`, RLS, el bucket `catalogo_imagenes` y la función helper

2. **Editar `config.js` con las credenciales del proyecto**
   ```js
   SUPABASE_URL: 'https://TU-PROYECTO.supabase.co',
   SUPABASE_KEY: 'sb_publishable_xxxxx',
   ```
   Estas dos líneas son iguales para TODOS los clientes y son las mismas que ya usas en los menús.

---

## ALTA DE UN NUEVO CLIENTE

Cada vez que entra un cliente nuevo, repetir:

### Paso 1 — Crear usuario en Supabase Auth
- En el dashboard de Supabase: `Authentication → Users → Add User`
- Email: el del cliente · Password: una temporal (ej: `Cliente2026!`)
- Marcar "Auto Confirm User"
- Copiar el **UUID del usuario** que se genera

### Paso 2 — Crear el negocio y vincularlo
En el SQL Editor de Supabase, correr:

```sql
select catalogo_crear_negocio(
    'UUID-DEL-USUARIO-DEL-PASO-1'::uuid,
    'Nombre Provisional del Negocio'
);
```

Esto devuelve un **UUID del negocio**. Cópialo.

### Paso 3 — Clonar la plantilla y configurar
1. Duplica la carpeta `plantilla/` y renómbrala (ej: `panaderia-juan/`)
2. Edita `config.js` y reemplaza:
   ```js
   BUSINESS_ID: 'UUID-DEL-NEGOCIO-DEL-PASO-2'
   ```

### Paso 4 — Desplegar
- Sube la carpeta a GitHub Pages, Netlify, Vercel o tu hosting
- URL pública del catálogo: `https://tudominio.com/panaderia-juan/`
- URL del panel: `https://tudominio.com/panaderia-juan/login.html`

### Paso 5 — Entregar al cliente
Envíale por correo / WhatsApp:
- 🔗 URL del catálogo
- 🔗 URL del panel
- 📧 Email de acceso
- 🔑 Contraseña temporal (recomienda que la cambie)

El cliente entra al panel y llena: identidad del negocio, categorías y productos.

---

## QUÉ VE EL CLIENTE EN EL PANEL

4 pestañas:

1. **Mi Negocio** — Logo, portada, nombre, descripción, horario, color de acento, contacto, redes sociales, toggle de opiniones
2. **Categorías** — Crear/editar/eliminar categorías propias con ícono (emoji), nombre y orden
3. **Productos** — CRUD con foto, precio, descripción, asignación de categoría, marcar como destacado, toggle agotado/disponible
4. **Opiniones** — Ver y eliminar reseñas que dejan los clientes finales

---

## SEGURIDAD

- RLS (Row Level Security) activado solo en las tablas nuevas con prefijo `catalogo_`
- Lectura pública solo para datos visibles del catálogo
- Escritura restringida: cada usuario solo puede modificar SU negocio (vinculado vía tabla `catalogo_usuarios_negocio`)
- Bucket `catalogo_imagenes` separado del bucket `imagenes` que usan los menús
- Las imágenes de cada negocio se guardan bajo carpeta `<business_id>/...`

---

## PERSONALIZACIÓN OPCIONAL POR CLIENTE

Si un cliente quiere algo más allá de la plantilla estándar (cobrar como upsell):
- **Tipografía propia**: cambiar el `<link>` de Google Fonts en `index.html` y `font-family` en `style.css`
- **Tema claro**: invertir variables CSS en `style.css` (`--bg-primary`, `--bg-card`, etc.)
- **Categorías predefinidas**: pre-cargar categorías con un INSERT al alta del cliente
- **Subdominio propio**: configurar DNS

---

## STACK

- HTML / CSS / JavaScript vanilla (sin frameworks, sin build)
- Supabase (Postgres + Auth + Storage)
- Hosting estático (GitHub Pages / Netlify / Vercel)

---

**AGENCY SENIORS** — Eduardo Daniel Pérez Ruiz
