// =====================================================================
// CATÁLOGO PÚBLICO - Lógica
// =====================================================================

let searchTimeout;
let todosLosProductos = [];
let todasLasCategorias = [];
let negocioInfo = null;
let productoActual = null;
let puntuacionSeleccionada = 0;
let monedaSeleccionada = null; // código de moneda activa (ej: 'CUP', 'USD')

// Metadatos de monedas soportadas
const MONEDAS_META = {
    CUP: { simbolo: '$',   nombre: 'Peso Cubano',       bandera: '🇨🇺', decimales: 0 },
    USD: { simbolo: '$',   nombre: 'Dólar (USA)',       bandera: '🇺🇸', decimales: 2 },
    EUR: { simbolo: '€',   nombre: 'Euro',              bandera: '🇪🇺', decimales: 2 },
    MXN: { simbolo: '$',   nombre: 'Peso Mexicano',     bandera: '🇲🇽', decimales: 2 },
    DOP: { simbolo: '$',   nombre: 'Peso Dominicano',   bandera: '🇩🇴', decimales: 2 },
    COP: { simbolo: '$',   nombre: 'Peso Colombiano',   bandera: '🇨🇴', decimales: 0 },
    ARS: { simbolo: '$',   nombre: 'Peso Argentino',    bandera: '🇦🇷', decimales: 0 },
    CLP: { simbolo: '$',   nombre: 'Peso Chileno',      bandera: '🇨🇱', decimales: 0 },
    PEN: { simbolo: 'S/',  nombre: 'Sol Peruano',       bandera: '🇵🇪', decimales: 2 },
    BRL: { simbolo: 'R$',  nombre: 'Real Brasileño',    bandera: '🇧🇷', decimales: 2 },
    VES: { simbolo: 'Bs',  nombre: 'Bolívar',           bandera: '🇻🇪', decimales: 2 },
    UYU: { simbolo: '$',   nombre: 'Peso Uruguayo',     bandera: '🇺🇾', decimales: 2 },
    GBP: { simbolo: '£',   nombre: 'Libra Esterlina',   bandera: '🇬🇧', decimales: 2 },
    CAD: { simbolo: '$',   nombre: 'Dólar Canadiense',  bandera: '🇨🇦', decimales: 2 },
};

// 1. CARGA INICIAL: info del negocio + categorías + productos
async function cargarTodo() {
    try {
        await cargarNegocio();
        inicializarMonedas(); // antes del render para que los precios salgan ya en la moneda activa
        await cargarCategorias();
        await cargarProductos();
        renderizarFiltros();
        renderizarMenu(todosLosProductos);
        // Cargar carrito desde localStorage (después de tener todosLosProductos)
        cargarCarrito();
        // Si la URL trae ?p=<id>, abrir ese producto directamente
        chequearProductoEnURL();
    } catch (err) {
        console.error("Error general:", err);
        mostrarError("No se pudo cargar el catálogo. Verifica la configuración.");
    }
}

// 2. INFO DEL NEGOCIO
async function cargarNegocio() {
    const { data, error } = await supabaseClient
        .from('catalogo_negocios')
        .select('*')
        .eq('id', CONFIG.BUSINESS_ID)
        .single();

    if (error || !data) {
        console.error("Negocio no encontrado:", error);
        return;
    }

    negocioInfo = data;
    aplicarIdentidadVisual(data);
}

function aplicarIdentidadVisual(n) {
    // Color de acento personalizado
    if (n.color_acento) {
        document.documentElement.style.setProperty('--accent', n.color_acento);
    }

    // Título de la pestaña
    document.getElementById('page-title').textContent = `${n.nombre} | Catálogo Digital`;

    // Header
    setText('hero-nombre', n.nombre || 'Mi Negocio');
    setText('hero-descripcion', n.descripcion || '');

    if (n.portada_url) {
        document.getElementById('hero-bg').src = n.portada_url;
    }

    if (n.logo_url) {
        const logo = document.getElementById('hero-logo');
        logo.src = n.logo_url;
        logo.style.display = 'block';
    }

    // Estado abierto/cerrado (basado en horario_semanal)
    if (n.horario_semanal) {
        const estado = calcularEstadoNegocio(n.horario_semanal);
        const estadoEl = document.getElementById('hero-estado');
        const estadoText = document.getElementById('hero-estado-text');
        if (estadoEl && estadoText) {
            estadoEl.style.display = 'inline-flex';
            estadoEl.classList.toggle('abierto', estado.abierto);
            estadoEl.classList.toggle('cerrado', !estado.abierto);
            estadoText.textContent = estado.texto;
        }
    }

    // Nota especial / horario texto libre
    if (n.horario && n.horario.trim()) {
        document.getElementById('hero-horario').style.display = 'block';
        setText('hero-horario-text', n.horario);
    }

    // Footer
    setText('footer-nombre', `${n.nombre} © ${new Date().getFullYear()}`);
    renderFooterContacto(n);

    // Buscador placeholder
    document.getElementById('search-input').placeholder = `Buscar en ${n.nombre}...`;
}

// =============== ESTADO ABIERTO/CERRADO ===============
// Devuelve { abierto: bool, texto: string }
function calcularEstadoNegocio(horarioSemanal) {
    const DIAS_KEYS = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
    const DIAS_NOMBRES = {
        dom: 'domingo', lun: 'lunes', mar: 'martes', mie: 'miércoles',
        jue: 'jueves', vie: 'viernes', sab: 'sábado'
    };

    const ahora = new Date();
    const diaHoyKey = DIAS_KEYS[ahora.getDay()];
    const minActuales = ahora.getHours() * 60 + ahora.getMinutes();

    const horarioHoy = horarioSemanal[diaHoyKey];

    // ¿Abierto ahora?
    if (horarioHoy && horarioHoy.abierto) {
        const [hApe, mApe] = (horarioHoy.apertura || '00:00').split(':').map(Number);
        const [hCie, mCie] = (horarioHoy.cierre || '00:00').split(':').map(Number);
        const aperturaMin = hApe * 60 + mApe;
        const cierreMin = hCie * 60 + mCie;

        if (minActuales >= aperturaMin && minActuales < cierreMin) {
            return {
                abierto: true,
                texto: `Abierto · Cierra a las ${formatHora(horarioHoy.cierre)}`
            };
        }

        // Está cerrado pero abre más tarde hoy
        if (minActuales < aperturaMin) {
            return {
                abierto: false,
                texto: `Cerrado · Abre hoy a las ${formatHora(horarioHoy.apertura)}`
            };
        }
    }

    // Buscar el próximo día abierto
    for (let i = 1; i <= 7; i++) {
        const idx = (ahora.getDay() + i) % 7;
        const key = DIAS_KEYS[idx];
        const h = horarioSemanal[key];
        if (h && h.abierto) {
            const cuando = i === 1 ? 'mañana' : DIAS_NOMBRES[key];
            return {
                abierto: false,
                texto: `Cerrado · Abre ${cuando} a las ${formatHora(h.apertura)}`
            };
        }
    }

    return { abierto: false, texto: 'Cerrado' };
}

function formatHora(hhmm) {
    if (!hhmm) return '';
    const [h, m] = hhmm.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}

function renderFooterContacto(n) {
    const cont = document.getElementById('footer-contacto');
    const items = [];

    if (n.whatsapp) {
        const num = n.whatsapp.replace(/[^0-9]/g, '');
        items.push(`<a href="https://wa.me/${num}" target="_blank"><span class="material-icons">chat</span> WhatsApp</a>`);
    }
    if (n.telefono) {
        items.push(`<a href="tel:${n.telefono}"><span class="material-icons">phone</span> ${n.telefono}</a>`);
    }
    if (n.instagram) {
        const ig = n.instagram.replace('@', '');
        items.push(`<a href="https://instagram.com/${ig}" target="_blank"><span class="material-icons">photo_camera</span> @${ig}</a>`);
    }
    if (n.facebook) {
        items.push(`<a href="${n.facebook.startsWith('http') ? n.facebook : 'https://facebook.com/' + n.facebook}" target="_blank"><span class="material-icons">facebook</span> Facebook</a>`);
    }
    if (n.direccion) {
        items.push(`<a href="https://maps.google.com/?q=${encodeURIComponent(n.direccion)}" target="_blank"><span class="material-icons">place</span> Ubicación</a>`);
    }

    cont.innerHTML = items.join('');
}

// 3. CATEGORÍAS
async function cargarCategorias() {
    const { data, error } = await supabaseClient
        .from('catalogo_categorias')
        .select('*')
        .eq('negocio_id', CONFIG.BUSINESS_ID)
        .eq('activo', true)
        .order('orden', { ascending: true })
        .order('id', { ascending: true });

    if (error) {
        console.error("Error categorías:", error);
        return;
    }

    todasLasCategorias = data || [];
}

function renderizarFiltros() {
    const nav = document.getElementById('filtros-nav');
    nav.innerHTML = `<button class="filter-btn active" onclick="irAlInicio(this)">🏠 Inicio</button>`;

    todasLasCategorias.forEach(cat => {
        nav.innerHTML += `<button class="filter-btn" data-cat-id="${cat.id}" onclick="filtrar(${cat.id}, this)">${cat.icono || '🏷️'} ${cat.nombre}</button>`;
    });
}

// 4. PRODUCTOS
async function cargarProductos() {
    const { data, error } = await supabaseClient
        .from('catalogo_productos')
        .select(`*, catalogo_opiniones(puntuacion)`)
        .eq('negocio_id', CONFIG.BUSINESS_ID)
        .eq('activo', true)
        .order('destacado', { ascending: false })
        .order('id', { ascending: false });

    // Como `*` ya trae imagenes_url, no necesito tocar el query.

    if (error) {
        console.error("Error productos:", error);
        return;
    }

    todosLosProductos = (data || []).map(prod => {
        const opiniones = prod.catalogo_opiniones || [];
        const total = opiniones.length;
        const suma = opiniones.reduce((acc, c) => acc + c.puntuacion, 0);
        prod.ratingPromedio = total ? (suma / total).toFixed(1) : null;
        return prod;
    });
}

// 5. RENDER DEL CATÁLOGO
function renderizarMenu(lista) {
    const cont = document.getElementById('menu-grid');
    if (!cont) return;
    cont.innerHTML = '';

    if (todasLasCategorias.length === 0 && lista.length === 0) {
        cont.innerHTML = `
            <div class="empty-state">
                <span class="material-icons">inventory_2</span>
                <h4>Catálogo en preparación</h4>
                <p>Aún no se han agregado productos.</p>
            </div>`;
        return;
    }

    if (lista.length === 0) {
        cont.innerHTML = `
            <div class="empty-state">
                <span class="material-icons">search_off</span>
                <h4>Sin resultados</h4>
                <p>No se encontraron productos.</p>
            </div>`;
        return;
    }

    // Agrupar por categoría usando el orden definido
    let html = '';

    todasLasCategorias.forEach(cat => {
        const productosCat = lista.filter(p => p.categoria_id === cat.id);
        if (productosCat.length === 0) return;

        html += `
            <div class="category-section" id="section-${cat.id}" data-cat-id="${cat.id}">
                <h2 class="category-title-casona">${cat.icono || '🏷️'} ${cat.nombre}</h2>
                <div class="horizontal-scroll">
                    ${productosCat.map(item => cardHTML(item)).join('')}
                </div>
            </div>`;
    });

    // Productos sin categoría
    const sinCat = lista.filter(p => !p.categoria_id || !todasLasCategorias.find(c => c.id === p.categoria_id));
    if (sinCat.length > 0) {
        html += `
            <div class="category-section" id="section-otros" data-cat-id="0">
                <h2 class="category-title-casona">🏷️ Otros</h2>
                <div class="horizontal-scroll">
                    ${sinCat.map(item => cardHTML(item)).join('')}
                </div>
            </div>`;
    }

    cont.innerHTML = html;
    activarVigilanciaCategorias();
}

function cardHTML(item) {
    const esAgotado = item.estado === 'agotado' || item.stock === 0;
    const claseAgotado = esAgotado ? 'is-agotado' : '';
    const badgeAgotado = esAgotado ? '<div class="badge-agotado-casona">AGOTADO</div>' : '';
    const onclick = esAgotado ? '' : `abrirDetalle(${item.id})`;
    const img = item.imagen_url || 'https://via.placeholder.com/300x300/f5f5f7/9ca3af?text=Sin+Imagen';

    // Oferta
    const hayOferta = item.en_oferta && item.precio_anterior && Number(item.precio_anterior) > Number(item.precio);
    let badgeOferta = '';
    let precioHTML;
    if (hayOferta) {
        const descuento = Math.round((1 - Number(item.precio) / Number(item.precio_anterior)) * 100);
        badgeOferta = `<span class="badge-oferta">-${descuento}%</span>`;
        precioHTML = `
            <span class="precio-anterior">${formatPrecio(item.precio_anterior)}</span>
            <span class="card-price card-price-oferta">${formatPrecio(item.precio)}</span>
        `;
    } else {
        precioHTML = `<span class="card-price">${formatPrecio(item.precio)}</span>`;
    }

    // Stock urgencia (1-5)
    const badgeStock = (!esAgotado && item.stock != null && item.stock > 0 && item.stock <= 5)
        ? `<div class="badge-stock-card">⚠ Solo quedan ${item.stock}</div>`
        : '';

    return `
        <div class="card-casona ${claseAgotado}" onclick="${onclick}">
            <div class="card-img-container">
                ${badgeAgotado}
                <img src="${img}" loading="lazy" onerror="this.src='https://via.placeholder.com/300x300/f5f5f7/9ca3af?text=Sin+Imagen'">
                ${item.destacado ? '<span class="tag-destacado">TOP</span>' : ''}
                ${badgeOferta}
            </div>
            <div class="card-body">
                <h3>${escapeHTML(item.nombre)}</h3>
                ${badgeStock}
                <div class="card-footer">${precioHTML}</div>
            </div>
        </div>
    `;
}

// 6. DETALLE / MODAL
async function abrirDetalle(id) {
    const idNum = Number(id);
    productoActual = todosLosProductos.find(p => p.id === idNum);
    if (!productoActual) return;

    setText('det-titulo', productoActual.nombre);
    setText('det-desc', productoActual.descripcion || 'Sin descripción.');

    // Precio (con/sin oferta)
    const hayOferta = productoActual.en_oferta
        && productoActual.precio_anterior
        && Number(productoActual.precio_anterior) > Number(productoActual.precio);
    const elPrice = document.getElementById('det-price');
    if (elPrice) {
        if (hayOferta) {
            const descuento = Math.round((1 - Number(productoActual.precio) / Number(productoActual.precio_anterior)) * 100);
            elPrice.innerHTML = `
                <span class="modal-precio-anterior">${formatPrecio(productoActual.precio_anterior)}</span>
                ${formatPrecio(productoActual.precio)}
                <span class="modal-descuento-tag">-${descuento}%</span>
            `;
        } else {
            elPrice.textContent = formatPrecio(productoActual.precio);
        }
    }

    // Stock urgencia en modal
    const detStock = document.getElementById('det-stock');
    if (detStock) {
        if (productoActual.stock != null && productoActual.stock > 0 && productoActual.stock <= 5) {
            detStock.style.display = 'block';
            detStock.textContent = `⚠ Solo quedan ${productoActual.stock} unidades`;
        } else {
            detStock.style.display = 'none';
        }
    }

    // Renderizar carrusel de imágenes (1 foto -> img simple, varias -> carrusel con dots/flechas)
    renderCarruselProducto(productoActual);

    // Botón "Agregar al pedido" — oculto si agotado o stock=0
    const btnCarrito = document.getElementById('btn-agregar-carrito');
    if (btnCarrito) {
        const sinStock = productoActual.estado === 'agotado'
            || (productoActual.stock != null && productoActual.stock <= 0);
        btnCarrito.style.display = sinStock ? 'none' : 'flex';
    }

    // Mostrar/ocultar opiniones según config del negocio
    const valBox = document.getElementById('valoracion-wrapper');
    const btnOp = document.getElementById('btn-dejar-opinion');
    if (negocioInfo && negocioInfo.opiniones_activas === false) {
        valBox.style.display = 'none';
        btnOp.style.display = 'none';
    } else {
        valBox.style.display = 'block';
        btnOp.style.display = 'block';
        await cargarPromedioOpiniones(idNum);
    }

    const modal = document.getElementById('modal-detalle');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);

    // Reflejar el producto abierto en la URL (deep link)
    try {
        const url = new URL(window.location.href);
        url.searchParams.set('p', idNum);
        window.history.replaceState({}, '', url.pathname + url.search);
    } catch (e) {}
}

async function cargarPromedioOpiniones(idNum) {
    try {
        const { data: notas } = await supabaseClient
            .from('catalogo_opiniones')
            .select('puntuacion')
            .eq('producto_id', idNum);

        let promedio = "0.0";
        let cantidad = 0;
        if (notas && notas.length > 0) {
            const suma = notas.reduce((a, c) => a + c.puntuacion, 0);
            promedio = (suma / notas.length).toFixed(1);
            cantidad = notas.length;
        }
        setText('det-puntuacion-valor', promedio);
        setText('det-cantidad-opiniones', `(${cantidad} reseñas)`);
    } catch (e) {
        console.error("Promedio:", e);
    }
}

function cerrarDetalle() {
    const modal = document.getElementById('modal-detalle');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
    // Limpiar el ?p= de la URL al cerrar (para no compartir un link "stale")
    if (window.location.search.includes('p=')) {
        const url = new URL(window.location.href);
        url.searchParams.delete('p');
        window.history.replaceState({}, '', url.pathname + (url.search || ''));
    }
}

// ====== CARRUSEL MULTI-FOTO EN MODAL DE PRODUCTO ======
let carruselIndex = 0;
let carruselImagenes = [];

function obtenerImagenesProducto(p) {
    // Prioridad: imagenes_url (array) -> imagen_url (singular legacy)
    if (Array.isArray(p.imagenes_url) && p.imagenes_url.length > 0) {
        const limpias = p.imagenes_url.filter(Boolean);
        if (limpias.length > 0) return limpias;
    }
    if (p.imagen_url) return [p.imagen_url];
    return [];
}

function renderCarruselProducto(producto) {
    const container = document.getElementById('modal-image-container');
    if (!container) return;

    const imagenes = obtenerImagenesProducto(producto);
    carruselImagenes = imagenes;
    carruselIndex = 0;

    // Si no hay imágenes -> placeholder
    if (imagenes.length === 0) {
        container.classList.remove('has-gallery');
        container.innerHTML = `<img id="det-img" src="https://via.placeholder.com/500x300/f5f5f7/9ca3af?text=Sin+Imagen" alt="" class="modal-img">`;
        return;
    }

    // Si solo hay 1 imagen -> img simple (mantiene compatibilidad con código viejo)
    if (imagenes.length === 1) {
        container.classList.remove('has-gallery');
        container.innerHTML = `<img id="det-img" src="${imagenes[0]}" alt="${escapeHTML(producto.nombre)}" class="modal-img">`;
        return;
    }

    // Carrusel
    container.classList.add('has-gallery');
    const slidesHTML = imagenes.map((url, i) => `
        <div class="modal-carousel-slide">
            <img src="${url}" alt="${escapeHTML(producto.nombre)} - foto ${i + 1}" loading="${i === 0 ? 'eager' : 'lazy'}">
        </div>
    `).join('');

    const dotsHTML = imagenes.map((_, i) => `
        <button class="modal-carousel-dot ${i === 0 ? 'active' : ''}" data-idx="${i}" onclick="carruselIr(${i})" aria-label="Foto ${i + 1}"></button>
    `).join('');

    container.innerHTML = `
        <div class="modal-carousel">
            <div class="modal-carousel-track" id="modal-carousel-track">
                ${slidesHTML}
            </div>
            <button class="modal-carousel-arrow prev" onclick="carruselAnterior()" aria-label="Anterior">
                <span class="material-icons">chevron_left</span>
            </button>
            <button class="modal-carousel-arrow next" onclick="carruselSiguiente()" aria-label="Siguiente">
                <span class="material-icons">chevron_right</span>
            </button>
            <div class="modal-carousel-dots" id="modal-carousel-dots">
                ${dotsHTML}
            </div>
        </div>
    `;

    // Soporte de swipe táctil
    activarSwipeCarrusel(container);
    actualizarFlechasCarrusel();
}

function carruselIr(idx) {
    if (idx < 0 || idx >= carruselImagenes.length) return;
    carruselIndex = idx;
    const track = document.getElementById('modal-carousel-track');
    if (track) track.style.transform = `translateX(-${idx * 100}%)`;

    document.querySelectorAll('.modal-carousel-dot').forEach((d, i) => {
        d.classList.toggle('active', i === idx);
    });
    actualizarFlechasCarrusel();
}

function carruselSiguiente() { carruselIr(carruselIndex + 1); }
function carruselAnterior() { carruselIr(carruselIndex - 1); }

function actualizarFlechasCarrusel() {
    const prev = document.querySelector('.modal-carousel-arrow.prev');
    const next = document.querySelector('.modal-carousel-arrow.next');
    if (prev) prev.disabled = carruselIndex === 0;
    if (next) next.disabled = carruselIndex === carruselImagenes.length - 1;
}

function activarSwipeCarrusel(container) {
    let startX = null;
    const SWIPE_THRESHOLD = 50;

    container.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
    }, { passive: true });

    container.addEventListener('touchend', (e) => {
        if (startX == null) return;
        const dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > SWIPE_THRESHOLD) {
            if (dx < 0) carruselSiguiente();
            else carruselAnterior();
        }
        startX = null;
    }, { passive: true });
}

// ====== COMPARTIR PRODUCTO INDIVIDUAL (deep link) ======
async function compartirProducto() {
    if (!productoActual) return;

    // Construir URL con ?p=<id>
    const url = new URL(window.location.href);
    url.searchParams.set('p', productoActual.id);
    const shareUrl = url.toString();

    const titulo = `${productoActual.nombre} — ${negocioInfo?.nombre || 'Catálogo'}`;
    const precio = formatPrecio(productoActual.precio);
    const texto = `${productoActual.nombre} · ${precio}\n${productoActual.descripcion || ''}`.trim();

    // Si el sistema soporta share nativo (móviles), usar eso
    if (navigator.share) {
        try {
            await navigator.share({ title: titulo, text: texto, url: shareUrl });
            return;
        } catch (e) {
            // El usuario canceló o falló — caemos al fallback
            if (e.name === 'AbortError') return;
        }
    }

    // Fallback: copiar al portapapeles
    try {
        await navigator.clipboard.writeText(shareUrl);
        toast('Link copiado al portapapeles');
    } catch (e) {
        // Último fallback: select + alert
        prompt('Copia este link:', shareUrl);
    }
}

// Si la URL trae ?p=<id>, abrir directamente el modal de ese producto
function chequearProductoEnURL() {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('p');
    if (!productId) return;

    const idNum = Number(productId);
    const existe = todosLosProductos.find(p => p.id === idNum);
    if (!existe) {
        console.warn(`Producto ${idNum} no encontrado en el catálogo`);
        return;
    }

    // Esperar un tick para que el grid se haya renderizado
    setTimeout(() => abrirDetalle(idNum), 200);
}

// 7. NAVEGACIÓN
function filtrar(catId, btn) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const buscador = document.getElementById('search-input');
    if (buscador && buscador.value !== "") {
        buscador.value = "";
        renderizarMenu(todosLosProductos);
    }

    const seccion = document.getElementById(`section-${catId}`);
    if (seccion) {
        const pos = seccion.offsetTop - 130;
        window.scrollTo({ top: pos, behavior: 'smooth' });
    }
}

function irAlInicio(btn) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const buscador = document.getElementById('search-input');
    if (buscador) buscador.value = "";

    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderizarMenu(todosLosProductos);
}

// 8. BUSCADOR
document.addEventListener('input', (e) => {
    if (e.target.id === 'search-input') {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const q = e.target.value.toLowerCase().trim();
            if (q === "") {
                renderizarMenu(todosLosProductos);
            } else {
                const filtrados = todosLosProductos.filter(p =>
                    p.nombre.toLowerCase().includes(q) ||
                    (p.descripcion && p.descripcion.toLowerCase().includes(q))
                );
                renderizarMenu(filtrados);
            }
        }, 300);
    }
});

// 9. SCROLL SPY (categoría activa)
let observadorScroll = null;
function activarVigilanciaCategorias() {
    if (observadorScroll) observadorScroll.disconnect();

    observadorScroll = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const catId = entry.target.getAttribute('data-cat-id');
                actualizarBotonActivo(catId);
            }
        });
    }, { rootMargin: '-150px 0px -70% 0px', threshold: 0 });

    document.querySelectorAll('.category-section').forEach(s => observadorScroll.observe(s));
}

function actualizarBotonActivo(catId) {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-cat-id') === String(catId)) {
            btn.classList.add('active');
            btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    });
}

// 10. OPINIONES
function abrirOpinionDesdeDetalle() {
    cerrarDetalle();
    const modal = document.getElementById('modal-opinion');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
    resetearFormularioOpinion();
}

function cerrarModalOpiniones() {
    const modal = document.getElementById('modal-opinion');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
}

function resetearFormularioOpinion() {
    puntuacionSeleccionada = 0;
    document.querySelectorAll('#stars-container span').forEach(s => s.style.color = '#444');
    document.getElementById('cliente-nombre').value = '';
    document.getElementById('cliente-comentario').value = '';
}

document.addEventListener('click', (e) => {
    const estrella = e.target.closest('#stars-container span');
    if (estrella) {
        puntuacionSeleccionada = parseInt(estrella.getAttribute('data-val'));
        const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2ECC71';
        document.querySelectorAll('#stars-container span').forEach((s, i) => {
            s.style.color = (i < puntuacionSeleccionada) ? accent : '#444';
        });
    }
});

async function enviarOpinion() {
    if (!puntuacionSeleccionada) {
        toast("Selecciona una puntuación con las estrellas.", true);
        return;
    }

    const nombre = document.getElementById('cliente-nombre').value.trim() || "Anónimo";
    const comentario = document.getElementById('cliente-comentario').value.trim();

    const btn = document.getElementById('btn-enviar-opinion');
    btn.disabled = true;
    btn.textContent = "ENVIANDO...";

    try {
        const { error } = await supabaseClient.from('catalogo_opiniones').insert([{
            negocio_id: CONFIG.BUSINESS_ID,
            producto_id: productoActual.id,
            cliente_nombre: nombre,
            comentario: comentario,
            puntuacion: puntuacionSeleccionada
        }]);

        if (error) throw error;

        toast("¡Gracias por tu opinión!");
        cerrarModalOpiniones();
    } catch (err) {
        console.error(err);
        toast("No se pudo enviar: " + err.message, true);
    } finally {
        btn.disabled = false;
        btn.textContent = "ENVIAR";
    }
}

async function abrirListaOpiniones() {
    if (!productoActual) return;
    const cont = document.getElementById('contenedor-opiniones-full');
    const modal = document.getElementById('modal-lista-opiniones');

    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
    cont.innerHTML = '<p style="text-align:center; padding:20px; color:#aaa;">Cargando comentarios...</p>';

    try {
        const { data: ops, error } = await supabaseClient
            .from('catalogo_opiniones')
            .select('*')
            .eq('producto_id', productoActual.id)
            .order('id', { ascending: false });

        if (error) throw error;

        if (!ops || ops.length === 0) {
            cont.innerHTML = '<p style="text-align:center; padding:20px; color:#666;">Este producto aún no tiene reseñas.</p>';
            return;
        }

        cont.innerHTML = ops.map(op => `
            <div style="background: rgba(255,255,255,0.03); padding:15px; border-radius:10px; margin-bottom:12px; border-left:3px solid var(--accent);">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="color:white; font-size:0.9rem;">${escapeHTML(op.cliente_nombre || 'Anónimo')}</strong>
                    <span style="color:#FFD700; font-size:0.8rem;">${'★'.repeat(op.puntuacion)}</span>
                </div>
                ${op.comentario ? `<p style="color:#bbb; font-size:0.85rem; margin-top:8px; line-height:1.4;">"${escapeHTML(op.comentario)}"</p>` : ''}
            </div>
        `).join('');
    } catch (err) {
        cont.innerHTML = '<p style="color:red; text-align:center;">Error al cargar opiniones.</p>';
    }
}

function cerrarListaOpiniones() {
    const modal = document.getElementById('modal-lista-opiniones');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
}

// =====================================================================
// MONEDAS — selector, conversión y formato
// =====================================================================

function getMonedasConfig() {
    const def = { base: 'CUP', activas: ['CUP'], tasas: {} };
    if (!negocioInfo || !negocioInfo.monedas) return def;
    const m = typeof negocioInfo.monedas === 'string'
        ? JSON.parse(negocioInfo.monedas)
        : negocioInfo.monedas;
    return {
        base: m.base || 'CUP',
        activas: Array.isArray(m.activas) && m.activas.length ? m.activas : [m.base || 'CUP'],
        tasas: m.tasas || {}
    };
}

function inicializarMonedas() {
    const config = getMonedasConfig();
    const wrapper = document.getElementById('currency-wrapper');

    // Si solo hay UNA moneda activa, ocultar el selector
    if (config.activas.length <= 1) {
        if (wrapper) wrapper.style.display = 'none';
        monedaSeleccionada = config.base;
        return;
    }

    // Recuperar selección previa de localStorage (si está en activas)
    const stored = localStorage.getItem(`cat_moneda_${CONFIG.BUSINESS_ID}`);
    monedaSeleccionada = (stored && config.activas.includes(stored)) ? stored : config.base;

    if (wrapper) wrapper.style.display = 'block';
    actualizarSelectorMoneda();
    renderMenuMoneda();
}

function actualizarSelectorMoneda() {
    const meta = MONEDAS_META[monedaSeleccionada] || MONEDAS_META.CUP;
    const flagEl = document.getElementById('cur-flag');
    const codeEl = document.getElementById('cur-code');
    if (flagEl) flagEl.textContent = meta.bandera;
    if (codeEl) codeEl.textContent = monedaSeleccionada;
}

function renderMenuMoneda() {
    const menu = document.getElementById('currency-menu');
    if (!menu) return;
    const config = getMonedasConfig();

    menu.innerHTML = config.activas.map(codigo => {
        const meta = MONEDAS_META[codigo] || { simbolo: '$', nombre: codigo, bandera: '💱' };
        const selected = codigo === monedaSeleccionada ? 'selected' : '';
        return `
            <button class="currency-option ${selected}" onclick="cambiarMoneda('${codigo}')" role="menuitem">
                <span class="cur-flag">${meta.bandera}</span>
                <span class="cur-text">
                    <span class="cur-code-row">${codigo}</span>
                    <span class="cur-name-row">${meta.nombre}</span>
                </span>
                <span class="material-icons cur-check">check</span>
            </button>
        `;
    }).join('');
}

function toggleMenuMoneda(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('currency-menu');
    const selector = document.getElementById('currency-selector');
    if (!menu || !selector) return;

    const isOpen = menu.classList.contains('open');
    if (isOpen) {
        cerrarMenuMoneda();
    } else {
        menu.classList.add('open');
        selector.classList.add('open');
    }
}

function cerrarMenuMoneda() {
    const menu = document.getElementById('currency-menu');
    const selector = document.getElementById('currency-selector');
    if (menu) menu.classList.remove('open');
    if (selector) selector.classList.remove('open');
}

// Cerrar al hacer click fuera
document.addEventListener('click', (e) => {
    if (!e.target.closest('.currency-wrapper')) {
        cerrarMenuMoneda();
    }
});

function cambiarMoneda(codigo) {
    if (codigo === monedaSeleccionada) {
        cerrarMenuMoneda();
        return;
    }
    monedaSeleccionada = codigo;
    localStorage.setItem(`cat_moneda_${CONFIG.BUSINESS_ID}`, codigo);

    actualizarSelectorMoneda();
    renderMenuMoneda();
    cerrarMenuMoneda();

    // Re-renderizar precios en todas partes
    renderizarMenu(todosLosProductos);
    if (productoActual) actualizarPrecioModal();
    renderCarrito();

    const meta = MONEDAS_META[codigo] || { nombre: codigo };
    toast(`Precios en ${meta.nombre}`);
}

function actualizarPrecioModal() {
    if (!productoActual) return;
    const hayOferta = productoActual.en_oferta
        && productoActual.precio_anterior
        && Number(productoActual.precio_anterior) > Number(productoActual.precio);
    const elPrice = document.getElementById('det-price');
    if (!elPrice) return;

    if (hayOferta) {
        const descuento = Math.round((1 - Number(productoActual.precio) / Number(productoActual.precio_anterior)) * 100);
        elPrice.innerHTML = `
            <span class="modal-precio-anterior">${formatPrecio(productoActual.precio_anterior)}</span>
            ${formatPrecio(productoActual.precio)}
            <span class="modal-descuento-tag">-${descuento}%</span>
        `;
    } else {
        elPrice.textContent = formatPrecio(productoActual.precio);
    }
}

// Convierte un precio del valor base al valor en la moneda seleccionada
function convertirPrecio(precioBase) {
    const config = getMonedasConfig();
    const destino = monedaSeleccionada || config.base;
    if (destino === config.base) return Number(precioBase);
    const tasa = config.tasas[destino];
    if (!tasa || isNaN(tasa) || Number(tasa) <= 0) return Number(precioBase);
    return Number(precioBase) / Number(tasa);
}

// Formatea un precio convertido a la moneda activa, con su símbolo
function formatPrecio(precioBase) {
    const valor = convertirPrecio(precioBase);
    const codigo = monedaSeleccionada || 'CUP';
    const meta = MONEDAS_META[codigo] || { simbolo: '$', decimales: 2 };
    const formateado = valor.toLocaleString('es', {
        minimumFractionDigits: meta.decimales,
        maximumFractionDigits: meta.decimales
    });
    return `${meta.simbolo}${formateado}`;
}

// 11. UTILIDADES
function setText(id, t) {
    const el = document.getElementById(id);
    if (el) el.textContent = t || '';
}

function escapeHTML(s) {
    if (!s) return '';
    return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function formatPrice(p) {
    if (p == null) return '0';
    return Number(p).toLocaleString('es-ES', { maximumFractionDigits: 2 });
}

function toast(msg, isError = false) {
    const cont = document.getElementById('toast-container');
    if (!cont) { alert(msg); return; }
    const t = document.createElement('div');
    t.className = 'toast' + (isError ? ' error' : '');
    t.textContent = msg;
    cont.appendChild(t);
    setTimeout(() => {
        t.style.opacity = '0';
        t.style.transition = 'opacity 0.3s';
        setTimeout(() => t.remove(), 300);
    }, 2800);
}

function mostrarError(msg) {
    const cont = document.getElementById('menu-grid');
    if (cont) {
        cont.innerHTML = `<div class="empty-state"><span class="material-icons">error_outline</span><h4>${msg}</h4></div>`;
    }
}

// =====================================================================
// CARRITO DE WHATSAPP
// =====================================================================

let carrito = []; // [{ productId, cantidad }]
const STORAGE_KEY_CARRITO = `cat_carrito_${CONFIG.BUSINESS_ID}`;

function cargarCarrito() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_CARRITO);
        if (raw) {
            carrito = JSON.parse(raw);
            // Filtrar items cuyo producto ya no exista
            carrito = carrito.filter(item => todosLosProductos.find(p => p.id === item.productId));
        }
    } catch (e) {
        carrito = [];
    }
    actualizarBadgeCarrito();
}

function guardarCarrito() {
    try {
        localStorage.setItem(STORAGE_KEY_CARRITO, JSON.stringify(carrito));
    } catch (e) {}
}

function agregarAlCarrito(productId, cantidad = 1) {
    const producto = todosLosProductos.find(p => p.id === productId);
    if (!producto) return false;

    if (producto.estado === 'agotado') {
        toast('Este producto está agotado', true);
        return false;
    }

    const existente = carrito.find(c => c.productId === productId);
    const cantidadEnCarrito = existente ? existente.cantidad : 0;
    const nuevaCantidad = cantidadEnCarrito + cantidad;

    // Respetar stock si está definido
    if (producto.stock != null && nuevaCantidad > producto.stock) {
        toast(`Solo quedan ${producto.stock} disponibles`, true);
        return false;
    }

    if (existente) {
        existente.cantidad = nuevaCantidad;
    } else {
        carrito.push({ productId, cantidad });
    }

    guardarCarrito();
    actualizarBadgeCarrito();
    toast(`✓ ${producto.nombre} agregado`);
    return true;
}

function agregarAlCarritoDesdeModal() {
    if (!productoActual) return;
    const ok = agregarAlCarrito(productoActual.id, 1);
    if (ok) {
        // Pequeño feedback visual en el botón
        const btn = document.getElementById('btn-agregar-carrito');
        if (btn) {
            const original = btn.innerHTML;
            btn.innerHTML = '<span class="material-icons">check</span> Agregado';
            btn.style.background = '#10b981';
            setTimeout(() => {
                btn.innerHTML = original;
                btn.style.background = '';
            }, 1200);
        }
    }
}

function cambiarCantidadCarrito(productId, delta) {
    const item = carrito.find(c => c.productId === productId);
    if (!item) return;

    const producto = todosLosProductos.find(p => p.id === productId);
    const nuevaCantidad = item.cantidad + delta;

    if (nuevaCantidad <= 0) {
        eliminarDelCarrito(productId);
        return;
    }

    if (producto && producto.stock != null && nuevaCantidad > producto.stock) {
        toast(`Solo quedan ${producto.stock} disponibles`, true);
        return;
    }

    item.cantidad = nuevaCantidad;
    guardarCarrito();
    actualizarBadgeCarrito();
    renderCarrito();
}

function eliminarDelCarrito(productId) {
    carrito = carrito.filter(c => c.productId !== productId);
    guardarCarrito();
    actualizarBadgeCarrito();
    renderCarrito();
}

function vaciarCarrito() {
    if (carrito.length === 0) return;
    if (!confirm('¿Vaciar todo el carrito?')) return;
    carrito = [];
    guardarCarrito();
    actualizarBadgeCarrito();
    renderCarrito();
}

function calcularTotalCarrito() {
    let total = 0;
    let unidades = 0;
    carrito.forEach(item => {
        const p = todosLosProductos.find(pr => pr.id === item.productId);
        if (p) {
            total += Number(p.precio) * item.cantidad;
            unidades += item.cantidad;
        }
    });
    return { total, unidades };
}

function actualizarBadgeCarrito() {
    const fab = document.getElementById('cart-fab');
    const badge = document.getElementById('cart-fab-badge');
    if (!fab || !badge) return;

    const { unidades } = calcularTotalCarrito();

    if (unidades > 0) {
        fab.classList.add('has-items');
        badge.textContent = unidades > 99 ? '99+' : unidades;
    } else {
        fab.classList.remove('has-items');
    }
}

function abrirCarrito() {
    renderCarrito();
    const drawer = document.getElementById('cart-drawer');
    drawer.style.display = 'flex';
    setTimeout(() => drawer.classList.add('active'), 10);
}

function cerrarCarrito() {
    const drawer = document.getElementById('cart-drawer');
    drawer.classList.remove('active');
    setTimeout(() => drawer.style.display = 'none', 300);
}

function renderCarrito() {
    const body = document.getElementById('cart-body');
    const footer = document.getElementById('cart-footer');
    const totalEl = document.getElementById('cart-total');
    const headerSub = document.getElementById('cart-header-sub');
    const sendBtn = document.getElementById('cart-send-btn');
    if (!body) return;

    if (carrito.length === 0) {
        body.innerHTML = `
            <div class="cart-empty">
                <span class="material-icons">shopping_cart</span>
                <h4>Tu carrito está vacío</h4>
                <p>Agrega productos desde el catálogo</p>
            </div>`;
        footer.classList.remove('show');
        headerSub.textContent = '0 productos';
        return;
    }

    footer.classList.add('show');

    body.innerHTML = carrito.map(item => {
        const p = todosLosProductos.find(pr => pr.id === item.productId);
        if (!p) return '';

        const subtotal = Number(p.precio) * item.cantidad;
        const img = p.imagen_url || 'https://via.placeholder.com/120x120/f5f5f7/9ca3af?text=Sin+Foto';
        const stockMax = p.stock != null ? p.stock : 999;
        const disabledPlus = item.cantidad >= stockMax;

        return `
            <div class="cart-item">
                <img src="${img}" class="cart-item-img" onerror="this.src='https://via.placeholder.com/120x120/f5f5f7/9ca3af?text=Sin+Foto'">
                <div class="cart-item-info">
                    <div class="cart-item-name">${escapeHTML(p.nombre)}</div>
                    <div class="cart-item-price-row">
                        <span class="cart-item-unit">${formatPrecio(p.precio)} c/u</span>
                        <span class="cart-item-subtotal">${formatPrecio(subtotal)}</span>
                    </div>
                    <div class="cart-qty-controls">
                        <button class="cart-qty-btn" onclick="cambiarCantidadCarrito(${p.id}, -1)" aria-label="Restar">−</button>
                        <span class="cart-qty-value">${item.cantidad}</span>
                        <button class="cart-qty-btn" onclick="cambiarCantidadCarrito(${p.id}, 1)" ${disabledPlus ? 'disabled' : ''} aria-label="Sumar">+</button>
                    </div>
                </div>
                <button class="cart-item-remove" onclick="eliminarDelCarrito(${p.id})" aria-label="Quitar">
                    <span class="material-icons">close</span>
                </button>
            </div>
        `;
    }).join('');

    const { total, unidades } = calcularTotalCarrito();
    totalEl.textContent = formatPrecio(total);
    headerSub.textContent = `${unidades} ${unidades === 1 ? 'producto' : 'productos'}`;

    // Habilitar/deshabilitar botón de envío según si el negocio tiene WhatsApp
    if (sendBtn) {
        if (negocioInfo && negocioInfo.whatsapp && negocioInfo.whatsapp.trim()) {
            sendBtn.disabled = false;
            sendBtn.title = '';
        } else {
            sendBtn.disabled = true;
            sendBtn.title = 'Este negocio no tiene WhatsApp configurado';
        }
    }
}

function enviarPedidoWhatsApp() {
    if (carrito.length === 0) return;

    if (!negocioInfo || !negocioInfo.whatsapp || !negocioInfo.whatsapp.trim()) {
        toast('Este negocio no tiene WhatsApp configurado', true);
        return;
    }

    // Construir el mensaje formateado con la moneda seleccionada
    const monedaCodigo = monedaSeleccionada || 'CUP';
    const lineas = [];
    lineas.push('🛒 *Nuevo pedido*');
    lineas.push('');

    let total = 0;
    carrito.forEach(item => {
        const p = todosLosProductos.find(pr => pr.id === item.productId);
        if (!p) return;
        const subtotal = Number(p.precio) * item.cantidad;
        total += subtotal;
        lineas.push(`• ${p.nombre} × ${item.cantidad} — ${formatPrecio(subtotal)} ${monedaCodigo}`);
    });

    lineas.push('');
    lineas.push(`*Total: ${formatPrecio(total)} ${monedaCodigo}*`);
    lineas.push('');
    lineas.push('Hola, me gustaría hacer este pedido.');

    const mensaje = encodeURIComponent(lineas.join('\n'));
    const numero = negocioInfo.whatsapp.replace(/[^0-9]/g, '');
    const url = `https://wa.me/${numero}?text=${mensaje}`;

    window.open(url, '_blank');

    // Cerrar el carrito (no lo vaciamos automáticamente — quedan los items por si quiere editar y reenviar)
    setTimeout(() => cerrarCarrito(), 400);
    toast('Abriendo WhatsApp...');
}

// 12. INIT
document.addEventListener('DOMContentLoaded', cargarTodo);
