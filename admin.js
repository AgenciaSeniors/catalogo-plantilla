// =====================================================================
// PANEL GERENCIAL - LÓGICA
// Maneja: Mi Negocio · Categorías · Productos · Opiniones
// =====================================================================

let inventarioGlobal = [];
let categoriasGlobal = [];
let opinionesGlobal = [];
let opinionesSeleccionadas = new Set();
let usuarioActual = null;
let monedasConfig = { base: 'CUP', activas: ['CUP'], tasas: {} };

// Monedas soportadas (debe coincidir con el catálogo público)
const ADMIN_MONEDAS_META = {
    CUP: { simbolo: '$',   nombre: 'Peso Cubano',       bandera: '🇨🇺' },
    USD: { simbolo: '$',   nombre: 'Dólar (USA)',       bandera: '🇺🇸' },
    EUR: { simbolo: '€',   nombre: 'Euro',              bandera: '🇪🇺' },
    MXN: { simbolo: '$',   nombre: 'Peso Mexicano',     bandera: '🇲🇽' },
    DOP: { simbolo: '$',   nombre: 'Peso Dominicano',   bandera: '🇩🇴' },
    COP: { simbolo: '$',   nombre: 'Peso Colombiano',   bandera: '🇨🇴' },
    ARS: { simbolo: '$',   nombre: 'Peso Argentino',    bandera: '🇦🇷' },
    CLP: { simbolo: '$',   nombre: 'Peso Chileno',      bandera: '🇨🇱' },
    PEN: { simbolo: 'S/',  nombre: 'Sol Peruano',       bandera: '🇵🇪' },
    BRL: { simbolo: 'R$',  nombre: 'Real Brasileño',    bandera: '🇧🇷' },
    VES: { simbolo: 'Bs',  nombre: 'Bolívar',           bandera: '🇻🇪' },
    UYU: { simbolo: '$',   nombre: 'Peso Uruguayo',     bandera: '🇺🇾' },
    GBP: { simbolo: '£',   nombre: 'Libra Esterlina',   bandera: '🇬🇧' },
    CAD: { simbolo: '$',   nombre: 'Dólar Canadiense',  bandera: '🇨🇦' },
};

// Días de la semana (para el horario estructurado)
const DIAS_SEMANA = [
    { key: 'lun', nombre: 'Lunes' },
    { key: 'mar', nombre: 'Martes' },
    { key: 'mie', nombre: 'Miércoles' },
    { key: 'jue', nombre: 'Jueves' },
    { key: 'vie', nombre: 'Viernes' },
    { key: 'sab', nombre: 'Sábado' },
    { key: 'dom', nombre: 'Domingo' }
];

// Horario por defecto al crear un negocio nuevo
function horarioPorDefecto() {
    const result = {};
    DIAS_SEMANA.forEach(d => {
        result[d.key] = {
            abierto: d.key !== 'dom', // domingo cerrado por defecto
            apertura: '09:00',
            cierre: '18:00'
        };
    });
    return result;
}

// =================== INIT & AUTH ===================
async function checkAuth() {
    try {
        if (typeof supabaseClient === 'undefined') {
            console.error("Supabase no detectado");
            return;
        }
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            window.location.href = "login.html";
            return;
        }
        usuarioActual = session.user;
        await initAdmin();
    } catch (err) {
        console.error("Error en Auth:", err);
    }
}

async function cerrarSesion() {
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
}

async function initAdmin() {
    setupTabs();
    await cargarNegocio();
    await cargarCategorias();
    await cargarProductos();
    await cargarOpiniones();
    inicializarCompartir();
    galeriaSet([]); // renderiza la galería vacía con el slot "+" para subir fotos
}

// =================== TABS ===================
function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.getAttribute('data-tab');
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('tab-' + tab).classList.add('active');
        });
    });
}

// =================== TAB MI NEGOCIO ===================
async function cargarNegocio() {
    try {
        const { data, error } = await supabaseClient
            .from('catalogo_negocios')
            .select('*')
            .eq('id', CONFIG.BUSINESS_ID)
            .single();

        if (error) throw error;

        // Aplicar color para que el admin se vea coherente
        if (data.color_acento) {
            document.documentElement.style.setProperty('--accent', data.color_acento);
        }

        document.getElementById('neg-nombre').value = data.nombre || '';
        document.getElementById('neg-descripcion').value = data.descripcion || '';
        document.getElementById('neg-horario').value = data.horario || '';
        document.getElementById('neg-color').value = data.color_acento || '#2929FF';
        document.getElementById('neg-telefono').value = data.telefono || '';
        document.getElementById('neg-whatsapp').value = data.whatsapp || '';
        document.getElementById('neg-direccion').value = data.direccion || '';
        document.getElementById('neg-instagram').value = data.instagram || '';
        document.getElementById('neg-facebook').value = data.facebook || '';
        document.getElementById('neg-opiniones').checked = data.opiniones_activas !== false;

        // Renderizar el horario semanal estructurado
        renderizarHorarioSemanal(data.horario_semanal || horarioPorDefecto());

        // Cargar y renderizar configuración de monedas
        cargarMonedasConfig(data.monedas);
        renderMonedasAdmin();

        if (data.logo_url) {
            const lp = document.getElementById('neg-logo-preview');
            lp.src = data.logo_url;
            lp.style.display = 'block';
            document.getElementById('neg-logo-prompt').style.display = 'none';
        }

        if (data.portada_url) {
            const pp = document.getElementById('neg-portada-preview');
            pp.src = data.portada_url;
            pp.style.display = 'block';
            document.getElementById('neg-portada-prompt').style.display = 'none';
        }
    } catch (err) {
        console.error("Cargar negocio:", err);
        toast("Error cargando datos del negocio", true);
    }
}

document.addEventListener('change', (e) => {
    if (e.target.id === 'neg-logo-file') previewImage(e.target, 'neg-logo-preview', 'neg-logo-prompt');
    if (e.target.id === 'neg-portada-file') previewImage(e.target, 'neg-portada-preview', 'neg-portada-prompt');
    if (e.target.id === 'galeria-file-input') galeriaSubirArchivos(e.target.files);
    if (e.target.id === 'en-oferta') {
        document.getElementById('precio-anterior-wrapper').style.display = e.target.checked ? 'block' : 'none';
    }
});

// =================== HORARIO SEMANAL ===================
function renderizarHorarioSemanal(horario) {
    const cont = document.getElementById('horario-semanal');
    if (!cont) return;

    cont.innerHTML = DIAS_SEMANA.map(d => {
        const h = horario[d.key] || { abierto: false, apertura: '09:00', cierre: '18:00' };
        return `
            <div class="horario-row" data-dia="${d.key}">
                <label class="horario-toggle">
                    <input type="checkbox" data-dia="${d.key}" data-tipo="abierto" ${h.abierto ? 'checked' : ''}>
                    <span class="horario-day-name">${d.nombre}</span>
                </label>
                <div class="horario-times" ${h.abierto ? '' : 'data-disabled="true"'}>
                    <input type="time" data-dia="${d.key}" data-tipo="apertura" value="${h.apertura || '09:00'}" ${h.abierto ? '' : 'disabled'}>
                    <span class="horario-sep">a</span>
                    <input type="time" data-dia="${d.key}" data-tipo="cierre" value="${h.cierre || '18:00'}" ${h.abierto ? '' : 'disabled'}>
                </div>
            </div>
        `;
    }).join('');

    // Escuchar cambios en los toggles de cada día
    cont.querySelectorAll('input[data-tipo="abierto"]').forEach(chk => {
        chk.addEventListener('change', (e) => {
            const dia = e.target.getAttribute('data-dia');
            const row = cont.querySelector(`.horario-row[data-dia="${dia}"]`);
            const times = row.querySelector('.horario-times');
            const inputs = row.querySelectorAll('input[type="time"]');
            if (e.target.checked) {
                times.removeAttribute('data-disabled');
                inputs.forEach(i => i.disabled = false);
            } else {
                times.setAttribute('data-disabled', 'true');
                inputs.forEach(i => i.disabled = true);
            }
        });
    });
}

function leerHorarioSemanal() {
    const cont = document.getElementById('horario-semanal');
    if (!cont) return null;

    const result = {};
    DIAS_SEMANA.forEach(d => {
        const row = cont.querySelector(`.horario-row[data-dia="${d.key}"]`);
        if (!row) return;
        const abierto = row.querySelector(`input[data-tipo="abierto"]`).checked;
        const apertura = row.querySelector(`input[data-tipo="apertura"]`).value || '09:00';
        const cierre = row.querySelector(`input[data-tipo="cierre"]`).value || '18:00';
        result[d.key] = { abierto, apertura, cierre };
    });
    return result;
}

// =================== MONEDAS ===================
function cargarMonedasConfig(raw) {
    let cfg = raw;
    if (typeof cfg === 'string') {
        try { cfg = JSON.parse(cfg); } catch (e) { cfg = null; }
    }
    monedasConfig = {
        base: (cfg && cfg.base) || 'CUP',
        activas: (cfg && Array.isArray(cfg.activas) && cfg.activas.length) ? cfg.activas : ['CUP'],
        tasas: (cfg && cfg.tasas) || {}
    };
    // Asegurar que la base esté siempre en "activas"
    if (!monedasConfig.activas.includes(monedasConfig.base)) {
        monedasConfig.activas.unshift(monedasConfig.base);
    }
}

function renderMonedasAdmin() {
    // 1. Llenar el select de moneda base
    const selectBase = document.getElementById('moneda-base');
    if (selectBase) {
        selectBase.innerHTML = Object.keys(ADMIN_MONEDAS_META).map(codigo => {
            const meta = ADMIN_MONEDAS_META[codigo];
            const selected = codigo === monedasConfig.base ? 'selected' : '';
            return `<option value="${codigo}" ${selected}>${meta.bandera} ${codigo} — ${meta.nombre}</option>`;
        }).join('');
    }

    // 2. Renderizar la lista de monedas (con checkbox + input de tasa)
    renderListaMonedas();
}

function renderListaMonedas() {
    const cont = document.getElementById('lista-monedas');
    if (!cont) return;

    cont.innerHTML = Object.keys(ADMIN_MONEDAS_META)
        .filter(codigo => codigo !== monedasConfig.base) // no listar la base aquí
        .map(codigo => {
            const meta = ADMIN_MONEDAS_META[codigo];
            const activa = monedasConfig.activas.includes(codigo);
            const tasa = monedasConfig.tasas[codigo] || '';

            return `
                <div class="moneda-row ${activa ? 'activa' : ''}" data-codigo="${codigo}">
                    <input type="checkbox" class="moneda-checkbox" data-codigo="${codigo}" ${activa ? 'checked' : ''}>
                    <span class="moneda-flag">${meta.bandera}</span>
                    <div class="moneda-info">
                        <span class="moneda-code">${codigo}</span>
                        <span class="moneda-name">${meta.nombre}</span>
                    </div>
                    <div class="moneda-tasa">
                        <span>1 ${codigo} =</span>
                        <input type="number" step="0.0001" min="0" class="moneda-tasa-input"
                               data-codigo="${codigo}" value="${tasa}"
                               placeholder="0.00" ${activa ? '' : 'disabled'}>
                        <span>${monedasConfig.base}</span>
                    </div>
                </div>
            `;
        }).join('');

    // Listeners
    cont.querySelectorAll('.moneda-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const codigo = e.target.dataset.codigo;
            const row = e.target.closest('.moneda-row');
            const tasaInput = row.querySelector('.moneda-tasa-input');
            if (e.target.checked) {
                row.classList.add('activa');
                tasaInput.disabled = false;
                if (!monedasConfig.activas.includes(codigo)) monedasConfig.activas.push(codigo);
            } else {
                row.classList.remove('activa');
                tasaInput.disabled = true;
                monedasConfig.activas = monedasConfig.activas.filter(c => c !== codigo);
            }
        });
    });

    cont.querySelectorAll('.moneda-tasa-input').forEach(inp => {
        inp.addEventListener('input', (e) => {
            const codigo = e.target.dataset.codigo;
            const val = parseFloat(e.target.value);
            if (!isNaN(val) && val > 0) {
                monedasConfig.tasas[codigo] = val;
            }
        });
    });

    // Listener del select de base — cuando cambia, re-renderizar la lista
    const selectBase = document.getElementById('moneda-base');
    if (selectBase && !selectBase.dataset.bound) {
        selectBase.dataset.bound = '1';
        selectBase.addEventListener('change', (e) => {
            const nuevaBase = e.target.value;
            // Si la base estaba en activas como adicional, quitarla
            monedasConfig.activas = monedasConfig.activas.filter(c => c !== monedasConfig.base);
            monedasConfig.base = nuevaBase;
            // Limpiar la tasa de la nueva base (no se necesita)
            delete monedasConfig.tasas[nuevaBase];
            // Asegurar que la nueva base esté en activas (al inicio)
            if (!monedasConfig.activas.includes(nuevaBase)) {
                monedasConfig.activas.unshift(nuevaBase);
            }
            renderListaMonedas();
        });
    }
}

function leerMonedasConfig() {
    // Limpiar tasas de monedas que no están activas
    const tasasLimpias = {};
    monedasConfig.activas.forEach(c => {
        if (c !== monedasConfig.base && monedasConfig.tasas[c]) {
            tasasLimpias[c] = monedasConfig.tasas[c];
        }
    });
    return {
        base: monedasConfig.base,
        activas: monedasConfig.activas,
        tasas: tasasLimpias
    };
}

function previewImage(input, previewId, promptId) {
    const file = input.files[0];
    const preview = document.getElementById(previewId);
    const prompt = document.getElementById(promptId);
    if (file && preview) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            preview.src = ev.target.result;
            preview.style.display = 'block';
            if (prompt) prompt.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }
}

document.addEventListener('submit', async (e) => {
    if (e.target.id === 'form-negocio') {
        e.preventDefault();
        await guardarNegocio();
    }
    if (e.target.id === 'form-categoria') {
        e.preventDefault();
        await guardarCategoria();
    }
    if (e.target.id === 'form-producto') {
        e.preventDefault();
        await guardarProducto();
    }
});

async function guardarNegocio() {
    const btn = document.getElementById('btn-save-negocio');
    btn.textContent = "Guardando...";
    btn.disabled = true;

    try {
        // Subir logo si hay nuevo
        const logoFile = document.getElementById('neg-logo-file').files[0];
        const portadaFile = document.getElementById('neg-portada-file').files[0];

        const datos = {
            nombre: document.getElementById('neg-nombre').value.trim(),
            descripcion: document.getElementById('neg-descripcion').value.trim(),
            horario: document.getElementById('neg-horario').value.trim(),
            horario_semanal: leerHorarioSemanal(),
            color_acento: document.getElementById('neg-color').value,
            telefono: document.getElementById('neg-telefono').value.trim(),
            whatsapp: document.getElementById('neg-whatsapp').value.trim(),
            direccion: document.getElementById('neg-direccion').value.trim(),
            instagram: document.getElementById('neg-instagram').value.trim(),
            facebook: document.getElementById('neg-facebook').value.trim(),
            opiniones_activas: document.getElementById('neg-opiniones').checked,
            monedas: leerMonedasConfig()
        };

        if (logoFile) {
            datos.logo_url = await subirArchivo(logoFile, 'logo');
        }
        if (portadaFile) {
            datos.portada_url = await subirArchivo(portadaFile, 'portada');
        }

        const { error } = await supabaseClient
            .from('catalogo_negocios')
            .update(datos)
            .eq('id', CONFIG.BUSINESS_ID);

        if (error) throw error;

        // Aplicar color en vivo
        document.documentElement.style.setProperty('--accent', datos.color_acento);

        toast("¡Información guardada!");
    } catch (err) {
        console.error(err);
        toast("Error: " + err.message, true);
    } finally {
        btn.textContent = "GUARDAR CAMBIOS";
        btn.disabled = false;
    }
}

// =================== TAB CATEGORÍAS ===================
async function cargarCategorias() {
    try {
        const { data, error } = await supabaseClient
            .from('catalogo_categorias')
            .select('*')
            .eq('negocio_id', CONFIG.BUSINESS_ID)
            .order('orden', { ascending: true })
            .order('id', { ascending: true });

        if (error) throw error;
        categoriasGlobal = data || [];

        renderListaCategorias();
        llenarSelectCategorias();
    } catch (err) {
        console.error("Cargar categorías:", err);
    }
}

function renderListaCategorias() {
    const lista = document.getElementById('lista-categorias');
    if (!lista) return;

    if (categoriasGlobal.length === 0) {
        lista.innerHTML = `
            <div class="empty-state" style="padding:30px;">
                <span class="material-icons">category</span>
                <h4>Sin categorías</h4>
                <p>Crea la primera categoría para organizar tus productos.</p>
            </div>`;
        return;
    }

    lista.innerHTML = categoriasGlobal.map(c => `
        <div class="categoria-row ${c.activo ? '' : 'is-inactiva'}" style="${c.activo ? '' : 'opacity:0.5;'}">
            <span class="cat-icon">${c.icono || '🏷️'}</span>
            <div style="flex:1;">
                <div class="cat-name">${escapeHTML(c.nombre)}</div>
                <div style="font-size:0.7rem; color:#777;">Orden: ${c.orden} ${c.activo ? '· Activa' : '· Oculta'}</div>
            </div>
            <div class="action-btn-group">
                <button class="icon-btn" onclick="editarCategoria(${c.id})" title="Editar"><span class="material-icons">edit</span></button>
                <button class="icon-btn" onclick="toggleCategoria(${c.id}, ${c.activo})" title="Mostrar/ocultar"><span class="material-icons">${c.activo ? 'visibility' : 'visibility_off'}</span></button>
                <button class="icon-btn btn-del" onclick="eliminarCategoria(${c.id})" title="Eliminar"><span class="material-icons">delete</span></button>
            </div>
        </div>
    `).join('');
}

function llenarSelectCategorias() {
    const select = document.getElementById('categoria');
    if (!select) return;
    select.innerHTML = '<option value="" disabled selected>Selecciona...</option>';
    categoriasGlobal.filter(c => c.activo).forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.icono || '🏷️'} ${escapeHTML(c.nombre)}</option>`;
    });
}

async function guardarCategoria() {
    const btn = document.getElementById('btn-save-categoria');
    btn.textContent = "Guardando...";
    btn.disabled = true;

    try {
        const id = document.getElementById('cat-edit-id').value;
        const datos = {
            negocio_id: CONFIG.BUSINESS_ID,
            nombre: document.getElementById('cat-nombre').value.trim(),
            icono: document.getElementById('cat-icono').value.trim() || '🏷️',
            orden: parseInt(document.getElementById('cat-orden').value) || 0
        };

        const { error } = id
            ? await supabaseClient.from('catalogo_categorias').update(datos).eq('id', id)
            : await supabaseClient.from('catalogo_categorias').insert([{ ...datos, activo: true }]);

        if (error) throw error;

        toast("Categoría guardada");
        cancelarEdicionCategoria();
        await cargarCategorias();
    } catch (err) {
        toast("Error: " + err.message, true);
    } finally {
        btn.textContent = "GUARDAR";
        btn.disabled = false;
    }
}

function editarCategoria(id) {
    const c = categoriasGlobal.find(x => x.id === id);
    if (!c) return;
    document.getElementById('cat-edit-id').value = c.id;
    document.getElementById('cat-nombre').value = c.nombre;
    document.getElementById('cat-icono').value = c.icono || '';
    document.getElementById('cat-orden').value = c.orden || 0;
    document.getElementById('cat-form-title').textContent = 'Editar Categoría';
    document.getElementById('cat-form-icon').textContent = 'edit';
    document.getElementById('btn-cancel-categoria').style.display = 'block';
    document.getElementById('cat-nombre').focus();
}

function cancelarEdicionCategoria() {
    document.getElementById('form-categoria').reset();
    document.getElementById('cat-edit-id').value = '';
    document.getElementById('cat-form-title').textContent = 'Nueva Categoría';
    document.getElementById('cat-form-icon').textContent = 'add_circle';
    document.getElementById('btn-cancel-categoria').style.display = 'none';
}

async function toggleCategoria(id, activoActual) {
    await supabaseClient.from('catalogo_categorias').update({ activo: !activoActual }).eq('id', id);
    await cargarCategorias();
}

async function eliminarCategoria(id) {
    if (!confirm("¿Eliminar esta categoría? Los productos asignados quedarán sin categoría.")) return;
    const { error } = await supabaseClient.from('catalogo_categorias').delete().eq('id', id);
    if (error) {
        toast("Error: " + error.message, true);
        return;
    }
    toast("Categoría eliminada");
    await cargarCategorias();
    await cargarProductos();
}

// =================== TAB PRODUCTOS ===================
async function cargarProductos() {
    const lista = document.getElementById('lista-admin');
    if (!lista) return;

    lista.innerHTML = '<div style="text-align:center; padding:30px; color:#aaa;">⟳ Cargando inventario...</div>';

    try {
        const { data, error } = await supabaseClient
            .from('catalogo_productos')
            .select('*')
            .eq('negocio_id', CONFIG.BUSINESS_ID)
            .eq('activo', true)
            .order('id', { ascending: false });

        if (error) throw error;
        inventarioGlobal = data || [];

        if (inventarioGlobal.length === 0) {
            lista.innerHTML = `
                <div class="empty-state" style="padding:30px;">
                    <span class="material-icons">inventory_2</span>
                    <h4>Inventario vacío</h4>
                    <p>Agrega tu primer producto desde el formulario.</p>
                </div>`;
            return;
        }

        lista.innerHTML = inventarioGlobal.map(item => {
            const esAgotado = item.estado === 'agotado' || item.stock === 0;
            const cat = categoriasGlobal.find(c => c.id === item.categoria_id);
            const catNombre = cat ? `${cat.icono} ${cat.nombre}` : 'Sin categoría';
            const starColor = item.destacado ? 'var(--accent)' : '#9ca3af';

            // Badges adicionales
            const badgeOferta = item.en_oferta && item.precio_anterior > item.precio
                ? `<span class="item-mini-badge badge-oferta">🔥 OFERTA</span>` : '';
            const badgeStock = (item.stock != null && item.stock > 0 && item.stock <= 5)
                ? `<span class="item-mini-badge badge-stock">⚠ Quedan ${item.stock}</span>` : '';

            // Precio: si oferta, mostrar anterior tachado
            const precioHTML = (item.en_oferta && item.precio_anterior > item.precio)
                ? `<span class="item-price"><span class="precio-anterior-mini">$${formatPrice(item.precio_anterior)}</span> $${formatPrice(item.precio)}</span>`
                : `<span class="item-price">$${formatPrice(item.precio)}</span>`;

            return `
                <div class="inventory-item">
                    <img src="${item.imagen_url || 'https://via.placeholder.com/60'}" class="item-thumb" onerror="this.src='https://via.placeholder.com/60'">
                    <div class="item-meta">
                        <span class="item-title">${escapeHTML(item.nombre)} ${item.destacado ? '🌟' : ''}</span>
                        ${precioHTML}
                        <span class="item-category">${catNombre}</span>
                        <div class="item-badges-row">
                            <span class="item-status ${esAgotado ? 'status-bad' : 'status-ok'}">${esAgotado ? 'AGOTADO' : 'DISPONIBLE'}</span>
                            ${badgeOferta}
                            ${badgeStock}
                        </div>
                    </div>
                    <div class="action-btn-group">
                        <button class="icon-btn" onclick="prepararEdicion(${item.id})" title="Editar"><span class="material-icons">edit</span></button>
                        <button class="icon-btn" style="color:${starColor};" onclick="toggleDestacado(${item.id}, ${item.destacado})" title="Destacar"><span class="material-icons">star</span></button>
                        <button class="icon-btn" onclick="toggleEstado(${item.id}, '${item.estado}')" title="Disponible/Agotado"><span class="material-icons">${esAgotado ? 'toggle_off' : 'toggle_on'}</span></button>
                        <button class="icon-btn btn-del" onclick="eliminarProducto(${item.id})" title="Eliminar"><span class="material-icons">delete</span></button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error(err);
        lista.innerHTML = `<p style="color:#ff5252; padding:20px; text-align:center;">Error: ${err.message}</p>`;
    }
}

async function guardarProducto() {
    const btn = document.getElementById('btn-submit');
    const idEdicion = document.getElementById('edit-id').value;

    btn.textContent = "Procesando...";
    btn.disabled = true;

    try {
        // Galería: obtener el array actual del input oculto
        const galeria = galeriaLeer();

        const enOferta = document.getElementById('en-oferta').checked;
        const precioAnteriorRaw = document.getElementById('precio-anterior').value;
        const stockRaw = document.getElementById('stock').value;

        const datos = {
            negocio_id: CONFIG.BUSINESS_ID,
            nombre: document.getElementById('nombre').value.trim(),
            precio: parseFloat(document.getElementById('precio').value) || 0,
            precio_anterior: enOferta && precioAnteriorRaw ? parseFloat(precioAnteriorRaw) : null,
            en_oferta: enOferta,
            stock: stockRaw === '' ? null : parseInt(stockRaw),
            estado: document.getElementById('estado').value || 'disponible',
            categoria_id: parseInt(document.getElementById('categoria').value) || null,
            descripcion: document.getElementById('descripcion').value.trim(),
            destacado: document.getElementById('destacado').checked,
            imagenes_url: galeria,
            // imagen_url (singular) refleja la primera imagen para compatibilidad y para usarla en cards
            imagen_url: galeria.length > 0 ? galeria[0] : null
        };

        const { error } = idEdicion
            ? await supabaseClient.from('catalogo_productos').update(datos).eq('id', idEdicion)
            : await supabaseClient.from('catalogo_productos').insert([{ ...datos, activo: true }]);

        if (error) throw error;

        toast(idEdicion ? "Producto actualizado" : "Producto creado");
        cancelarEdicion();
        await cargarProductos();
    } catch (err) {
        console.error(err);
        toast("Error: " + err.message, true);
    } finally {
        btn.textContent = idEdicion ? "ACTUALIZAR PRODUCTO" : "GUARDAR PRODUCTO";
        btn.disabled = false;
    }
}

function prepararEdicion(id) {
    const p = inventarioGlobal.find(p => p.id === id);
    if (!p) return;

    document.getElementById('edit-id').value = p.id;
    document.getElementById('nombre').value = p.nombre || '';
    document.getElementById('precio').value = p.precio || 0;
    document.getElementById('categoria').value = p.categoria_id || '';
    document.getElementById('descripcion').value = p.descripcion || '';
    document.getElementById('destacado').checked = !!p.destacado;
    document.getElementById('estado').value = p.estado || 'disponible';
    document.getElementById('stock').value = p.stock != null ? p.stock : '';
    document.getElementById('en-oferta').checked = !!p.en_oferta;
    document.getElementById('precio-anterior').value = p.precio_anterior || '';
    document.getElementById('precio-anterior-wrapper').style.display = p.en_oferta ? 'block' : 'none';

    // Cargar galería: usa imagenes_url (array) si existe, si no cae a imagen_url (singular)
    let imagenes = [];
    if (Array.isArray(p.imagenes_url) && p.imagenes_url.length > 0) {
        imagenes = p.imagenes_url.filter(Boolean);
    } else if (p.imagen_url) {
        imagenes = [p.imagen_url];
    }
    galeriaSet(imagenes);

    document.getElementById('btn-submit').textContent = "ACTUALIZAR PRODUCTO";
    document.getElementById('btn-cancelar').style.display = "block";
    document.getElementById('prod-form-title').textContent = 'Editar Producto';
    document.getElementById('prod-form-icon').textContent = 'edit';

    // Cambiar a tab productos si no estaba
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
    document.querySelector('[data-tab="productos"]').classList.add('active');
    document.getElementById('tab-productos').classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicion() {
    document.getElementById('form-producto').reset();
    document.getElementById('edit-id').value = "";
    document.getElementById('btn-submit').textContent = "GUARDAR PRODUCTO";
    document.getElementById('btn-cancelar').style.display = "none";
    document.getElementById('prod-form-title').textContent = 'Nuevo Producto';
    document.getElementById('prod-form-icon').textContent = 'add_circle';
    document.getElementById('precio-anterior-wrapper').style.display = 'none';
    document.getElementById('estado').value = 'disponible';

    galeriaSet([]); // vaciar galería
}

async function toggleDestacado(id, valor) {
    await supabaseClient.from('catalogo_productos').update({ destacado: !valor }).eq('id', id);
    await cargarProductos();
}

async function toggleEstado(id, est) {
    const nuevo = est === 'disponible' ? 'agotado' : 'disponible';
    await supabaseClient.from('catalogo_productos').update({ estado: nuevo }).eq('id', id);
    await cargarProductos();
}

async function eliminarProducto(id) {
    if (!confirm("¿Eliminar este producto?")) return;
    await supabaseClient.from('catalogo_productos').update({ activo: false }).eq('id', id);
    toast("Producto eliminado");
    await cargarProductos();
}

// Buscador inventario
document.addEventListener('input', (e) => {
    if (e.target.id === 'buscadorInventario') {
        const txt = e.target.value.toLowerCase().trim();
        const items = document.getElementById('lista-admin').children;
        Array.from(items).forEach(it => {
            it.style.display = it.innerText.toLowerCase().includes(txt) ? '' : 'none';
        });
    }
});

// =================== TAB OPINIONES ===================
async function cargarOpiniones() {
    const lista = document.getElementById('lista-opiniones');
    if (!lista) return;

    lista.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);">⟳ Cargando opiniones...</div>';
    opinionesSeleccionadas.clear();
    actualizarBulkBar();

    try {
        const { data, error } = await supabaseClient
            .from('catalogo_opiniones')
            .select('*, catalogo_productos(nombre)')
            .eq('negocio_id', CONFIG.BUSINESS_ID)
            .order('creado_en', { ascending: false });

        if (error) throw error;
        opinionesGlobal = data || [];

        const selectAllBar = document.getElementById('opiniones-select-all');

        if (!opinionesGlobal.length) {
            if (selectAllBar) selectAllBar.style.display = 'none';
            lista.innerHTML = `
                <div class="empty-state" style="padding:30px;">
                    <span class="material-icons">star_outline</span>
                    <h4>Sin opiniones aún</h4>
                    <p>Cuando tus clientes dejen reseñas, aparecerán aquí.</p>
                </div>`;
            return;
        }

        if (selectAllBar) selectAllBar.style.display = 'flex';

        lista.innerHTML = opinionesGlobal.map(op => `
            <div class="opinion-item" data-id="${op.id}">
                <label class="opinion-check">
                    <input type="checkbox" data-op-id="${op.id}" onchange="toggleSeleccionOpinion(${op.id}, this.checked)">
                </label>
                <div class="opinion-body">
                    <div class="opinion-top">
                        <div>
                            <strong class="opinion-author">${escapeHTML(op.cliente_nombre || 'Anónimo')}</strong>
                            <span class="opinion-stars">${'★'.repeat(op.puntuacion)}${'☆'.repeat(5 - op.puntuacion)}</span>
                        </div>
                        <button class="icon-btn btn-del" onclick="eliminarOpinion(${op.id})" title="Eliminar"><span class="material-icons">delete</span></button>
                    </div>
                    <div class="opinion-meta">
                        ${op.catalogo_productos ? escapeHTML(op.catalogo_productos.nombre) : 'Producto eliminado'} · ${formatFecha(op.creado_en)}
                    </div>
                    ${op.comentario
                        ? `<p class="opinion-text">"${escapeHTML(op.comentario)}"</p>`
                        : '<p class="opinion-text opinion-text-empty"><em>Sin comentario</em></p>'}
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error(err);
        lista.innerHTML = `<p style="color:var(--danger); padding:20px; text-align:center;">Error: ${err.message}</p>`;
    }
}

function toggleSeleccionOpinion(id, marcada) {
    if (marcada) opinionesSeleccionadas.add(id);
    else opinionesSeleccionadas.delete(id);
    actualizarBulkBar();
}

function toggleSeleccionarTodasOpiniones(checkbox) {
    if (checkbox.checked) {
        opinionesGlobal.forEach(op => opinionesSeleccionadas.add(op.id));
    } else {
        opinionesSeleccionadas.clear();
    }
    // sincronizar todos los checkboxes individuales
    document.querySelectorAll('input[data-op-id]').forEach(chk => {
        chk.checked = checkbox.checked;
    });
    actualizarBulkBar();
}

function deseleccionarTodasOpiniones() {
    opinionesSeleccionadas.clear();
    document.querySelectorAll('input[data-op-id]').forEach(chk => chk.checked = false);
    const selectAll = document.getElementById('chk-select-all-opiniones');
    if (selectAll) selectAll.checked = false;
    actualizarBulkBar();
}

function actualizarBulkBar() {
    const bar = document.getElementById('opiniones-bulk-bar');
    const count = document.getElementById('bulk-count');
    if (!bar || !count) return;
    if (opinionesSeleccionadas.size > 0) {
        bar.style.display = 'flex';
        count.textContent = opinionesSeleccionadas.size;
    } else {
        bar.style.display = 'none';
    }
}

async function eliminarOpinionesSeleccionadas() {
    if (opinionesSeleccionadas.size === 0) return;
    const cuantas = opinionesSeleccionadas.size;
    if (!confirm(`¿Eliminar ${cuantas} opinión(es) seleccionada(s)? Esta acción no se puede deshacer.`)) return;

    try {
        const ids = Array.from(opinionesSeleccionadas);
        const { error } = await supabaseClient.from('catalogo_opiniones').delete().in('id', ids);
        if (error) throw error;
        toast(`${cuantas} opinión(es) eliminada(s)`);
        opinionesSeleccionadas.clear();
        await cargarOpiniones();
    } catch (err) {
        toast("Error: " + err.message, true);
    }
}

async function eliminarOpinion(id) {
    if (!confirm("¿Eliminar esta opinión?")) return;
    const { error } = await supabaseClient.from('catalogo_opiniones').delete().eq('id', id);
    if (error) {
        toast("Error: " + error.message, true);
        return;
    }
    toast("Opinión eliminada");
    await cargarOpiniones();
}

// =================== HELPERS ===================

// Comprime una imagen a WebP, target 30-80 KB
// Redimensiona a max 1200px (lado más largo) e itera calidad hasta caer en rango
async function comprimirImagen(file) {
    const TARGET_MIN = 30 * 1024;    // 30 KB
    const TARGET_MAX = 80 * 1024;    // 80 KB
    const MAX_DIMENSION = 1200;       // px en lado más largo

    // Si ya está optimizada (WebP pequeña), no la tocamos
    if (file.type === 'image/webp' && file.size <= TARGET_MAX) {
        return file;
    }

    try {
        // 1. Cargar la imagen al DOM
        const img = await new Promise((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = () => reject(new Error('No se pudo leer la imagen'));
            i.src = URL.createObjectURL(file);
        });

        // 2. Calcular dimensiones (mantiene aspecto)
        let { width, height } = img;
        if (width > height && width > MAX_DIMENSION) {
            height = Math.round(height * (MAX_DIMENSION / width));
            width = MAX_DIMENSION;
        } else if (height >= width && height > MAX_DIMENSION) {
            width = Math.round(width * (MAX_DIMENSION / height));
            height = MAX_DIMENSION;
        }

        // 3. Dibujar al canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(img.src);

        // 4. Iterar calidad hasta caer en el rango target
        let quality = 0.80;
        let blob = await new Promise(r => canvas.toBlob(r, 'image/webp', quality));
        let intentos = 0;

        while (intentos < 8) {
            if (blob.size <= TARGET_MAX && blob.size >= TARGET_MIN) break;
            if (blob.size > TARGET_MAX) {
                quality -= 0.12;
                if (quality < 0.20) break;
            } else {
                quality += 0.08;
                if (quality > 0.95) break;
            }
            blob = await new Promise(r => canvas.toBlob(r, 'image/webp', quality));
            intentos++;
        }

        console.log(
            `📦 Compresión: ${(file.size/1024).toFixed(0)} KB → ${(blob.size/1024).toFixed(0)} KB ` +
            `(${width}x${height}, quality ${quality.toFixed(2)})`
        );

        return new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), {
            type: 'image/webp',
            lastModified: Date.now()
        });

    } catch (err) {
        console.warn('Compresión falló, subiendo original:', err);
        return file;
    }
}

async function subirArchivo(archivo, prefijo = 'img') {
    // Comprimir antes de subir (target 30-80 KB en WebP)
    const archivoOptim = await comprimirImagen(archivo);

    const ext = archivoOptim.name.split('.').pop() || 'webp';
    const path = `${CONFIG.BUSINESS_ID}/${prefijo}_${Date.now()}.${ext}`;

    const { error: upErr } = await supabaseClient.storage.from('catalogo_imagenes').upload(path, archivoOptim, {
        cacheControl: '3600',
        upsert: false
    });
    if (upErr) throw upErr;

    const { data } = supabaseClient.storage.from('catalogo_imagenes').getPublicUrl(path);
    return data.publicUrl;
}

function escapeHTML(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function formatPrice(p) {
    if (p == null) return '0';
    return Number(p).toLocaleString('es-ES', { maximumFractionDigits: 2 });
}

function formatFecha(f) {
    if (!f) return '';
    try {
        return new Date(f).toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' });
    } catch (e) { return ''; }
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

// =================== GALERÍA MULTI-FOTO (editor en form de producto) ===================
const GALERIA_MAX = 3;
let galeriaDragIndex = null;

function galeriaLeer() {
    try {
        const raw = document.getElementById('galeria-data').value;
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr.filter(Boolean) : [];
    } catch (e) {
        return [];
    }
}

function galeriaSet(arrUrls) {
    const arr = (arrUrls || []).filter(Boolean).slice(0, GALERIA_MAX);
    document.getElementById('galeria-data').value = JSON.stringify(arr);
    galeriaRenderizar();
}

function galeriaRenderizar() {
    const grid = document.getElementById('galeria-grid');
    if (!grid) return;
    const urls = galeriaLeer();

    const SVG_X = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
    const SVG_ADD = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>';

    let html = '';
    urls.forEach((url, idx) => {
        html += `
            <div class="galeria-slot has-image" draggable="true" data-idx="${idx}"
                 ondragstart="galeriaDragStart(event, ${idx})"
                 ondragover="galeriaDragOver(event)"
                 ondrop="galeriaDrop(event, ${idx})"
                 ondragend="galeriaDragEnd(event)">
                ${idx === 0 ? '<span class="badge-principal">PRINCIPAL</span>' : ''}
                <img src="${url}" alt="Imagen ${idx + 1}">
                <button type="button" class="btn-quitar" onclick="galeriaQuitar(${idx})" title="Quitar">
                    ${SVG_X}
                </button>
            </div>
        `;
    });

    // Slot de "Añadir" si aún no llegamos al máximo
    if (urls.length < GALERIA_MAX) {
        html += `
            <label class="galeria-slot add-slot" for="galeria-file-input" title="Añadir foto">
                ${SVG_ADD}
                <span class="add-slot-text">Añadir foto</span>
            </label>
        `;
    }

    grid.innerHTML = html;
}

async function galeriaSubirArchivos(fileList) {
    if (!fileList || fileList.length === 0) return;
    const actuales = galeriaLeer();
    const disponibles = GALERIA_MAX - actuales.length;
    if (disponibles <= 0) {
        toast(`Máximo ${GALERIA_MAX} fotos por producto`, true);
        return;
    }

    const aSubir = Array.from(fileList).slice(0, disponibles);
    const grid = document.getElementById('galeria-grid');

    // Mostrar slots con "Subiendo..." inmediatamente para feedback
    aSubir.forEach((_, i) => {
        const tempIdx = actuales.length + i;
        const tempSlot = document.createElement('div');
        tempSlot.className = 'galeria-slot has-image';
        tempSlot.innerHTML = `<div class="upload-progress">Subiendo...</div>`;
        tempSlot.dataset.uploading = `tmp-${tempIdx}`;
        grid.insertBefore(tempSlot, grid.querySelector('.add-slot'));
    });

    // Subir en paralelo
    try {
        const urls = await Promise.all(aSubir.map(f => subirArchivo(f, 'prod')));
        galeriaSet([...actuales, ...urls]);

        // Limpiar el input para permitir re-seleccionar el mismo archivo si lo borraron
        const inp = document.getElementById('galeria-file-input');
        if (inp) inp.value = '';
    } catch (err) {
        console.error('Error subiendo:', err);
        toast('Error al subir alguna foto: ' + err.message, true);
        galeriaRenderizar(); // re-renderizar para quitar los slots temporales
    }
}

function galeriaQuitar(idx) {
    const arr = galeriaLeer();
    arr.splice(idx, 1);
    galeriaSet(arr);
}

function galeriaDragStart(e, idx) {
    galeriaDragIndex = idx;
    e.currentTarget.classList.add('dragging');
    if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
    }
}

function galeriaDragOver(e) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
}

function galeriaDrop(e, dropIdx) {
    e.preventDefault();
    if (galeriaDragIndex == null || galeriaDragIndex === dropIdx) return;
    const arr = galeriaLeer();
    const [moved] = arr.splice(galeriaDragIndex, 1);
    arr.splice(dropIdx, 0, moved);
    galeriaSet(arr);
    galeriaDragIndex = null;
}

function galeriaDragEnd(e) {
    if (e.currentTarget) e.currentTarget.classList.remove('dragging');
    galeriaDragIndex = null;
}

// =================== TAB COMPARTIR (QR + URL + redes) ===================

function getCatalogoURL() {
    // Construye la URL pública del catálogo a partir del URL actual del admin
    // (admin.html -> index.html en la misma carpeta)
    const u = new URL(window.location.href);
    u.pathname = u.pathname.replace(/admin\.html$/, 'index.html');
    if (!u.pathname.endsWith('index.html')) {
        u.pathname = u.pathname.endsWith('/') ? u.pathname + 'index.html' : u.pathname + '/index.html';
    }
    u.search = '';
    u.hash = '';
    return u.toString();
}

function inicializarCompartir() {
    const url = getCatalogoURL();
    const inp = document.getElementById('share-url-input');
    if (inp) inp.value = url;

    // Generar QR
    renderQR(url);

    // Mostrar nombre del negocio bajo el QR
    const nameEl = document.getElementById('qr-business-name');
    if (nameEl) {
        const nombre = document.getElementById('neg-nombre')?.value?.trim() || 'Mi Negocio';
        nameEl.textContent = nombre;
    }
}

function renderQR(text) {
    const wrapper = document.getElementById('qr-canvas-wrapper');
    if (!wrapper || typeof qrcode === 'undefined') return;

    try {
        // type 0 = auto, ECC 'M' = ~15% redundancia (estándar)
        const qr = qrcode(0, 'M');
        qr.addData(text);
        qr.make();
        // Tamaño del módulo (cuadradito): 7px da ~240px total
        wrapper.innerHTML = qr.createImgTag(7, 8);
        // Aplicar estilos consistentes
        const img = wrapper.querySelector('img');
        if (img) {
            img.style.width = '240px';
            img.style.height = '240px';
        }
    } catch (e) {
        console.error('Error generando QR:', e);
        wrapper.innerHTML = '<p style="color:#ef4444;">Error generando QR</p>';
    }
}

async function copiarURLCatalogo() {
    const inp = document.getElementById('share-url-input');
    if (!inp) return;
    try {
        await navigator.clipboard.writeText(inp.value);
        toast('Link copiado');
    } catch (e) {
        inp.select();
        document.execCommand('copy');
        toast('Link copiado');
    }
}

function compartirCatalogo(red) {
    const url = getCatalogoURL();
    const nombre = document.getElementById('neg-nombre')?.value?.trim() || 'mi negocio';
    const texto = `Mira el catálogo digital de ${nombre}:`;
    const textoURL = encodeURIComponent(`${texto} ${url}`);
    const urlEnc = encodeURIComponent(url);
    const textoEnc = encodeURIComponent(texto);

    const links = {
        whatsapp: `https://wa.me/?text=${textoURL}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${urlEnc}`,
        telegram: `https://t.me/share/url?url=${urlEnc}&text=${textoEnc}`,
        email: `mailto:?subject=${textoEnc}&body=${textoURL}`
    };

    if (links[red]) {
        window.open(links[red], '_blank');
    }
}

function descargarQR() {
    const wrapper = document.getElementById('qr-canvas-wrapper');
    const img = wrapper?.querySelector('img');
    if (!img) {
        toast('Genera primero el QR', true);
        return;
    }

    // Construir un canvas con el QR + el nombre del negocio abajo
    const nombre = document.getElementById('neg-nombre')?.value?.trim() || 'Mi Negocio';
    const filenameSafe = nombre.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    const SIZE = 720;
    const PADDING = 60;
    const QR_AREA = SIZE - PADDING * 2;
    const FOOTER_HEIGHT = 100;

    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE + FOOTER_HEIGHT;
    const ctx = canvas.getContext('2d');

    // Fondo blanco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // QR centrado
    const qrImg = new Image();
    qrImg.crossOrigin = 'anonymous';
    qrImg.onload = () => {
        ctx.drawImage(qrImg, PADDING, PADDING, QR_AREA, QR_AREA);

        // Texto debajo
        ctx.fillStyle = '#0a0a0a';
        ctx.textAlign = 'center';
        ctx.font = '700 32px Inter, system-ui, sans-serif';
        ctx.fillText(nombre, SIZE / 2, SIZE + 12);

        // Punto azul Señores como marca
        ctx.fillStyle = '#2929ff';
        const nameWidth = ctx.measureText(nombre).width;
        ctx.beginPath();
        ctx.arc(SIZE / 2 + nameWidth / 2 + 12, SIZE + 12, 6, 0, Math.PI * 2);
        ctx.fill();

        // Sub-línea
        ctx.fillStyle = '#9ca3af';
        ctx.font = '500 16px Inter, system-ui, sans-serif';
        ctx.fillText('CATÁLOGO DIGITAL — escanea el QR', SIZE / 2, SIZE + 50);

        // Descargar
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `qr-${filenameSafe}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast('QR descargado');
        }, 'image/png');
    };
    qrImg.onerror = () => toast('Error generando la imagen', true);
    qrImg.src = img.src;
}

// =================== START ===================
document.addEventListener('DOMContentLoaded', checkAuth);
