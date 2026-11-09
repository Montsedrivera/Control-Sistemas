//const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Si estás en tu PC local usa localhost:3000; si estás en memoriadigital usa Ngrok
//const API_URL = IS_LOCAL 
 // ? 'http://localhost:3000/api' 
 // : 'https://calm-creamlike-grip.ngrok-free.dev/api';
// Base de datos de Usuarios para Autenticación Local
const VALID_USERS = {
  'admin': 'admin123',
  'sistemas': 'elrey123'
};

const API_URL = 'http://localhost:3000/api';

// Estado Global (Dependiente únicamente de MySQL)
let currentUser = localStorage.getItem('elrey_user') || null;
let activities = [];
let historyLogs = [];
let compras = [];
let corteFilteredData = [];

const STATUS_COLORS = {
  'Pendiente': '#FFD21C',
  'En proceso': '#36A9F5',
  'En espera': '#F28A24',
  'Completada': '#20B66B',
  'Cancelada': '#6B7F99',
  'Rechazada': '#E92E3D'
};

// Instancias de Chart.js
let chartStatusInstance = null;
let chartBranchesInstance = null;
let chartCategoriesInstance = null;
let chartWorkTypesInstance = null;
let miniChartInstance = null;

// --- CARGA DE DATOS DESDE BACKEND MYSQL ---
async function loadDataFromDB() {
  try {
    const [actRes, compRes] = await Promise.all([
      fetch(`${API_URL}/actividades`),
      fetch(`${API_URL}/compras`)
    ]);

    if (actRes.ok) activities = await actRes.json();
    if (compRes.ok) compras = await compRes.json();

    updateDashboard();
    if (document.getElementById('view-activities').style.display !== 'none') {
      renderActivities();
    }
    if (document.getElementById('view-compras').style.display !== 'none') {
      renderCompras();
    }
  } catch (err) {
    console.error('❌ Error al conectar con el servidor Node.js:', err);
  }
}

// --- DESPLEGABLES PERSONALIZADOS ---
function toggleDropdown(id) {
  document.querySelectorAll('.dropdown-content').forEach(d => {
    if (d.id !== id) d.classList.remove('show');
  });
  document.getElementById(id).classList.toggle('show');
}

window.addEventListener('click', function(e) {
  if (!e.target.closest('.custom-dropdown')) {
    document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));
  }
});

function getSelectedCheckboxes(containerId) {
  const checkboxes = document.querySelectorAll(`#${containerId} input[type="checkbox"]:checked`);
  return Array.from(checkboxes).map(cb => cb.value);
}

function updateDropdownLabels() {
  const statuses = getSelectedCheckboxes('dropdown-status');
  const branches = getSelectedCheckboxes('dropdown-branch');

  document.getElementById('label-status').innerText = statuses.length > 0 ? `${statuses.length} sel.` : 'Todos los estatus';
  document.getElementById('label-branch').innerText = branches.length > 0 ? `${branches.length} sel.` : 'Todas las sucursales';
}

function onFilterCheckboxChange() {
  updateDropdownLabels();
  renderActivities();
}

// --- AUTENTICACIÓN ---
function checkAuth() {
  const loginScreen = document.getElementById('login-screen');
  const appContainer = document.getElementById('app-container');

  if (currentUser) {
    loginScreen.style.display = 'none';
    appContainer.style.display = 'flex';
    document.getElementById('current-user-display').innerText = currentUser.toUpperCase();
    loadDataFromDB();
  } else {
    loginScreen.style.display = 'flex';
    appContainer.style.display = 'none';
  }
}

function handleLogin(e) {
  e.preventDefault();
  const user = document.getElementById('login-user').value.trim().toLowerCase();
  const pass = document.getElementById('login-pass').value.trim();
  const errorDiv = document.getElementById('login-error');

  if (VALID_USERS[user] && VALID_USERS[user] === pass) {
    currentUser = user;
    localStorage.setItem('elrey_user', currentUser);
    errorDiv.style.display = 'none';
    document.getElementById('login-form').reset();
    checkAuth();
  } else {
    errorDiv.style.display = 'block';
  }
}

function handleLogout() {
  if (confirm('¿Deseas cerrar la sesión actual?')) {
    currentUser = null;
    localStorage.removeItem('elrey_user');
    checkAuth();
  }
}

function showView(viewName) {
  if (viewName !== 'activities') clearFilters();

  document.querySelectorAll('.view-section').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  
  document.getElementById(`view-${viewName}`).style.display = 'block';
  const navBtn = document.getElementById(`nav-${viewName}`);
  if (navBtn) navBtn.classList.add('active');
  
  if (viewName === 'home') updateDashboard();
  if (viewName === 'activities') renderActivities();
  if (viewName === 'compras') renderCompras();
  if (viewName === 'corte') initCorteDates();
  if (viewName === 'history') renderHistory();
  if (viewName === 'report') renderReport();
}

function filterFromCard(statusFilter) {
  showView('activities');
  clearFilters();
  
  if (statusFilter !== 'Todos') {
    const cb = document.querySelector(`#dropdown-status input[value="${statusFilter}"]`);
    if (cb) cb.checked = true;
  }
  updateDropdownLabels();
  renderActivities();
}

function updateDashboard() {
  const today = new Date().toISOString().split('T')[0];
  
  const total = activities.length;
  const pending = activities.filter(a => a.status === 'Pendiente').length;
  const process = activities.filter(a => a.status === 'En proceso' || a.status === 'En espera').length;
  const done = activities.filter(a => a.status === 'Completada').length;
  const late = activities.filter(a => a.status !== 'Completada' && a.status !== 'Cancelada' && a.dueDate && a.dueDate < today).length;

  document.getElementById('m-total').innerText = total;
  document.getElementById('m-pending').innerText = pending;
  document.getElementById('m-process').innerText = process;
  document.getElementById('m-done').innerText = done;
  document.getElementById('m-late').innerText = late;

  const recentContainer = document.getElementById('recent-list');
  recentContainer.innerHTML = '';
  activities.slice(-5).reverse().forEach(a => {
    recentContainer.appendChild(createActivityCard(a));
  });

  const branchSummary = document.getElementById('branch-summary');
  branchSummary.innerHTML = '';
  const branches = ['Alcalde', 'Escobedo', 'Saucito', 'Pozos', 'B. Anaya', 'Corporativo', 'CPYD'];
  
  const branchCounts = branches.map(b => 
    activities.filter(a => a.branch === b && a.status !== 'Completada' && a.status !== 'Cancelada').length
  );
  const maxOpen = Math.max(...branchCounts, 1);

  branches.forEach((b, idx) => {
    const count = branchCounts[idx];
    const percentage = Math.round((count / maxOpen) * 100);

    const item = document.createElement('div');
    item.className = 'branch-item';
    item.innerHTML = `
      <div class="branch-info">
        <span>${b}</span>
        <strong>${count} abierta${count === 1 ? '' : 's'}</strong>
      </div>
      <div class="branch-bar-bg">
        <div class="branch-bar-fill" style="width: ${count > 0 ? Math.max(percentage, 8) : 0}%; background-color: ${count > 0 ? '#0868BD' : '#CBD5E1'};"></div>
      </div>
    `;
    item.onclick = () => {
      showView('activities');
      clearFilters();
      const cb = document.querySelector(`#dropdown-branch input[value="${b}"]`);
      if (cb) cb.checked = true;
      updateDropdownLabels();
      renderActivities();
    };
    branchSummary.appendChild(item);
  });

  renderMiniBranchChart(branches, branchCounts);
}

function renderMiniBranchChart(labels, data) {
  const ctx = document.getElementById('miniChartBranches');
  if (!ctx) return;
  if (miniChartInstance) miniChartInstance.destroy();

  miniChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{ label: 'Abiertas', data: data, backgroundColor: '#0868BD', borderRadius: 4 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 9 } } },
        y: { display: false, beginAtZero: true }
      }
    }
  });
}

function createActivityCard(a) {
  const today = new Date().toISOString().split('T')[0];
  const isLate = a.status !== 'Completada' && a.status !== 'Cancelada' && a.dueDate && a.dueDate < today;
  
  const div = document.createElement('div');
  div.className = `activity-card ${isLate ? 'overdue' : ''}`;
  
  const color = STATUS_COLORS[a.status] || '#0868BD';
  const fontColor = a.status === 'Pendiente' ? '#12345A' : '#FFFFFF';

  div.innerHTML = `
    <div class="card-top">
      <span>#${String(a.id).padStart(5, '0')} &bull; ${a.branch} &bull; ${a.category}</span>
      <span class="card-badge" style="background-color: ${isLate ? '#E92E3D' : color}; color: ${fontColor}">
        ${isLate ? 'VENCIDA' : a.status.toUpperCase()}
      </span>
    </div>
    <div class="card-problem">${a.problem}</div>
    <div class="card-bottom">
      <span>Det. ${a.detectionDate} ${a.dueDate ? '| Cierre: ' + a.dueDate : ''} | Equip: ${a.equipment}</span>
      <div class="card-actions">
        <span>${a.progress}% </span>
        ${a.status !== 'Completada' ? `<button class="btn btn-green btn-sm" onclick="completeToday(${a.id})">✓ Cerrar hoy</button>` : ''}
        <button class="btn btn-secondary btn-sm" onclick="openForm(${a.id})">Abrir / Editar</button>
      </div>
    </div>
  `;
  return div;
}

async function completeToday(id) {
  const a = activities.find(item => item.id === id);
  if (!a) return;

  const today = new Date().toISOString().split('T')[0];
  const solution = prompt(`Completar actividad #${String(a.id).padStart(5, '0')} con fecha de hoy (${today}).\n\nEscribe la solución realizada:`, a.action || 'Se resolvió la actividad.');

  if (solution === null) return;

  const payload = {
    ...a,
    status: 'Completada',
    progress: 100,
    dueDate: today,
    action: solution.trim() || 'Actividad completada.'
  };

  try {
    const res = await fetch(`${API_URL}/actividades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      await loadDataFromDB();
      alert(`¡Actividad #${String(a.id).padStart(5, '0')} COMPLETADA!`);
    }
  } catch (err) {
    console.error('Error al actualizar la actividad:', err);
  }
}

function renderActivities() {
  const search = document.getElementById('filter-search').value.toLowerCase();
  const startDate = document.getElementById('filter-start-date').value;
  const endDate = document.getElementById('filter-end-date').value;
  
  const selectedStatuses = getSelectedCheckboxes('dropdown-status');
  const selectedBranches = getSelectedCheckboxes('dropdown-branch');
  
  const today = new Date().toISOString().split('T')[0];
  const container = document.getElementById('activities-list');
  container.innerHTML = '';

  const filtered = activities.filter(a => {
    const formattedId = `#${String(a.id).padStart(5, '0')}`;
    const matchesSearch = formattedId.toLowerCase().includes(search) || 
                          String(a.id).includes(search) || 
                          a.problem.toLowerCase().includes(search) || 
                          a.equipment.toLowerCase().includes(search);
    
    let matchesDate = true;
    const actDate = a.detectionDate;
    if (startDate && actDate < startDate) matchesDate = false;
    if (endDate && actDate > endDate) matchesDate = false;

    let matchesStatus = false;
    if (selectedStatuses.length === 0) {
      matchesStatus = true;
    } else {
      if (selectedStatuses.includes('Abiertas') && (a.status !== 'Completada' && a.status !== 'Cancelada')) matchesStatus = true;
      if (selectedStatuses.includes('Vencidas') && (a.status !== 'Completada' && a.status !== 'Cancelada' && a.dueDate && a.dueDate < today)) matchesStatus = true;
      if (selectedStatuses.includes(a.status)) matchesStatus = true;
    }

    let matchesBranch = false;
    if (selectedBranches.length === 0) {
      matchesBranch = true;
    } else {
      if (selectedBranches.includes(a.branch)) matchesBranch = true;
    }

    return matchesSearch && matchesDate && matchesStatus && matchesBranch;
  });

  document.getElementById('activities-count').innerText = `${filtered.length} de ${activities.length} actividades`;
  filtered.forEach(a => container.appendChild(createActivityCard(a)));
}

function clearFilters() {
  document.getElementById('filter-search').value = '';
  document.getElementById('filter-start-date').value = '';
  document.getElementById('filter-end-date').value = '';
  
  document.querySelectorAll('#dropdown-status input, #dropdown-branch input').forEach(cb => cb.checked = false);
  updateDropdownLabels();
  renderActivities();
}

function openForm(id = null) {
  document.getElementById('activity-form').reset();
  document.getElementById('field-id').value = '';
  document.getElementById('field-detection-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('log-entry-section').style.display = 'none';

  if (id) {
    const a = activities.find(item => item.id === id);
    if (a) {
      document.getElementById('modal-title').innerText = `EDITAR ACTIVIDAD #${String(a.id).padStart(5, '0')}`;
      document.getElementById('field-id').value = a.id;
      document.getElementById('field-origin').value = a.origin;
      document.getElementById('field-category').value = a.category;
      document.getElementById('field-work-type').value = a.workType;
      document.getElementById('field-branch').value = a.branch;
      document.getElementById('field-equipment').value = a.equipment;
      document.getElementById('field-problem').value = a.problem;
      document.getElementById('field-action').value = a.action || '';
      document.getElementById('field-detection-date').value = a.detectionDate;
      document.getElementById('field-due-date').value = a.dueDate || '';
      document.getElementById('field-priority').value = a.priority;
      document.getElementById('field-status').value = a.status;
      document.getElementById('field-progress').value = a.progress;
      document.getElementById('progress-val').innerText = a.progress + '%';
      document.getElementById('log-entry-section').style.display = 'block';
    }
  } else {
    document.getElementById('modal-title').innerText = `NUEVA ACTIVIDAD`;
  }

  document.getElementById('form-modal').style.display = 'flex';
}

function closeForm() {
  document.getElementById('form-modal').style.display = 'none';
}

function onStatusChange(status) {
  if (status === 'Completada') {
    document.getElementById('field-progress').value = 100;
    document.getElementById('progress-val').innerText = '100%';
    if (!document.getElementById('field-due-date').value) {
      document.getElementById('field-due-date').value = new Date().toISOString().split('T')[0];
    }
  }
}

async function saveActivity(e) {
  e.preventDefault();

  const id = document.getElementById('field-id').value;
  const status = document.getElementById('field-status').value;
  const progress = parseInt(document.getElementById('field-progress').value, 10);
  const action = document.getElementById('field-action').value.trim();

  if (status === 'Completada' && !action) {
    alert('Para completar la actividad debe detallar la Acción Realizada / Solución.');
    return;
  }

  const payload = {
    id: id ? parseInt(id, 10) : null,
    origin: document.getElementById('field-origin').value,
    category: document.getElementById('field-category').value,
    workType: document.getElementById('field-work-type').value,
    branch: document.getElementById('field-branch').value,
    equipment: document.getElementById('field-equipment').value,
    problem: document.getElementById('field-problem').value,
    action: action,
    detectionDate: document.getElementById('field-detection-date').value,
    dueDate: document.getElementById('field-due-date').value || null,
    priority: document.getElementById('field-priority').value,
    status: status,
    progress: progress
  };

  try {
    const response = await fetch(`${API_URL}/actividades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      await loadDataFromDB();
      closeForm();
    } else {
      alert('Error al registrar la actividad en MySQL.');
    }
  } catch (err) {
    console.error('Error al guardar la actividad:', err);
  }
}

// --- MÓDULO DE COMPRAS (LINKS Y ARCHIVOS PDF) ---
function setupPdfListeners() {
  ['1', '2', '3'].forEach(num => {
    const fileInput = document.getElementById(`comp-p${num}-pdf`);
    if (fileInput) {
      fileInput.onchange = function(e) {
        const file = e.target.files[0];
        if (file) {
          if (file.type !== 'application/pdf') {
            alert('Por favor selecciona un archivo PDF válido.');
            fileInput.value = '';
            return;
          }
          const reader = new FileReader();
          reader.onload = function(evt) {
            document.getElementById(`comp-p${num}-pdf-data`).value = evt.target.result;
            document.getElementById(`comp-p${num}-pdf-status`).innerText = `✓ PDF listo (${file.name})`;
          };
          reader.readAsDataURL(file);
        }
      };
    }
  });
}

function openPdfWindow(base64Data) {
  const pdfWindow = window.open("");
  pdfWindow.document.write(`<iframe width='100%' height='100%' src='${base64Data}' style='border:none;'></iframe>`);
}

function renderCompras() {
  const search = document.getElementById('comp-filter-search').value.toLowerCase();
  const status = document.getElementById('comp-filter-status').value;
  const branch = document.getElementById('comp-filter-branch').value;

  document.getElementById('comp-total').innerText = compras.length;
  document.getElementById('comp-high').innerText = compras.filter(c => c.priority === 'Alta' || c.priority === 'Crítica').length;
  document.getElementById('comp-process').innerText = compras.filter(c => c.status === 'En proceso' || c.status === 'Pendiente').length;
  document.getElementById('comp-done').innerText = compras.filter(c => c.status === 'Completada').length;

  const container = document.getElementById('compras-list');
  container.innerHTML = '';

  const filtered = compras.filter(c => {
    const folioStr = `#C${String(c.id).padStart(4, '0')}`;
    const matchesSearch = folioStr.toLowerCase().includes(search) || 
                          c.title.toLowerCase().includes(search) || 
                          c.dept.toLowerCase().includes(search);
    const matchesStatus = status === 'Todos' || c.status === status;
    const matchesBranch = branch === 'Todas' || c.branch === branch;
    return matchesSearch && matchesStatus && matchesBranch;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="card-panel" style="text-align:center; padding: 20px;">No hay compras registradas con estos criterios.</div>`;
    return;
  }

  filtered.forEach(c => {
    const card = document.createElement('div');
    card.className = 'activity-card';
    const color = STATUS_COLORS[c.status] || '#7650D8';

    const renderOptionBox = (optNum, optData, optLabel) => {
      const isSelected = c.selectedOption === optLabel;
      if (!optData || (!optData.name && !optData.url)) {
        return `<div style="background:#FFF; padding:6px; border:1px solid #DDD; border-radius:6px;"><strong>${optLabel}:</strong><br>Sin cotizar</div>`;
      }

      const isPdfData = optData.url && optData.url.startsWith('data:application/pdf');

      return `
        <div style="background: ${isSelected ? '#E6F4EA' : '#FFF'}; padding:6px; border:1px solid ${isSelected ? '#20B66B' : '#DDD'}; border-radius:6px;">
          <strong>${optLabel} ${isSelected ? '✓ (Elegida)' : ''}:</strong><br>
          ${optData.name || 'Proveedor N/A'} - <strong>$${optData.price || '0'}</strong> (${optData.time || 'N/A'})
          <div style="margin-top:4px; display:flex; gap:4px; flex-wrap:wrap;">
            ${optData.url && !isPdfData ? `<a href="${optData.url}" target="_blank" class="btn btn-blue btn-sm" style="padding:2px 6px; text-decoration:none;">🔗 Link Web</a>` : ''}
            ${isPdfData ? `<button class="btn btn-purple btn-sm" style="padding:2px 6px;" onclick="openPdfWindow('${optData.url}')">📄 Ver PDF</button>` : ''}
          </div>
        </div>
      `;
    };

    card.innerHTML = `
      <div class="card-top">
        <span>#C${String(c.id).padStart(4, '0')} &bull; ${c.branch} &bull; Depto: ${c.dept} &bull; Prioridad: <strong>${c.priority}</strong></span>
        <span class="card-badge" style="background-color: ${color}">${c.status.toUpperCase()}</span>
      </div>
      <div class="card-problem"><strong>${c.title}</strong></div>
      ${c.notes ? `<div style="font-size:0.85rem; color:var(--muted);">${c.notes}</div>` : ''}
      
      <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 8px; font-size: 0.8rem;">
        ${renderOptionBox(1, c.p1, 'Opción 1')}
        ${renderOptionBox(2, c.p2, 'Opción 2')}
        ${renderOptionBox(3, c.p3, 'Opción 3')}
      </div>

      <div class="card-bottom" style="margin-top: 10px;">
        <span>Fecha Límite: ${c.date || 'Sin definir'}</span>
        <div class="card-actions">
          <button class="btn btn-secondary btn-sm" onclick="openCompraForm(${c.id})">Editar / Cotizaciones</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function openCompraForm(id = null) {
  document.getElementById('compra-form').reset();
  document.getElementById('comp-id').value = '';
  ['1', '2', '3'].forEach(n => {
    document.getElementById(`comp-p${n}-pdf-data`).value = '';
    document.getElementById(`comp-p${n}-pdf-status`).innerText = '';
  });

  if (id) {
    const c = compras.find(item => item.id === id);
    if (c) {
      document.getElementById('compra-modal-title').innerText = `EDITAR COMPRA #C${String(c.id).padStart(4, '0')}`;
      document.getElementById('comp-id').value = c.id;
      document.getElementById('comp-title').value = c.title;
      document.getElementById('comp-priority').value = c.priority;
      document.getElementById('comp-branch').value = c.branch;
      document.getElementById('comp-dept').value = c.dept;
      document.getElementById('comp-status').value = c.status;
      document.getElementById('comp-date').value = c.date || '';
      document.getElementById('comp-selected-option').value = c.selectedOption || 'Ninguna';
      document.getElementById('comp-notes').value = c.notes || '';

      ['1', '2', '3'].forEach(n => {
        const p = c[`p${n}`];
        if (p) {
          document.getElementById(`comp-p${n}-name`).value = p.name || '';
          document.getElementById(`comp-p${n}-price`).value = p.price || '';
          document.getElementById(`comp-p${n}-time`).value = p.time || '';
          document.getElementById(`comp-p${n}-notes`).value = p.notes || '';
          if (p.url && p.url.startsWith('data:application/pdf')) {
            document.getElementById(`comp-p${n}-pdf-data`).value = p.url;
            document.getElementById(`comp-p${n}-pdf-status`).innerText = '✓ PDF guardado en BD';
          } else {
            document.getElementById(`comp-p${n}-url`).value = p.url || '';
          }
        }
      });
    }
  } else {
    document.getElementById('compra-modal-title').innerText = `NUEVA COMPRA PRIORIZADA`;
  }

  document.getElementById('compra-modal').style.display = 'flex';
}

function closeCompraForm() {
  document.getElementById('compra-modal').style.display = 'none';
}

async function saveCompra(e) {
  e.preventDefault();

  const id = document.getElementById('comp-id').value;

  const payload = {
    id: id ? parseInt(id, 10) : null,
    title: document.getElementById('comp-title').value.trim(),
    priority: document.getElementById('comp-priority').value,
    branch: document.getElementById('comp-branch').value,
    dept: document.getElementById('comp-dept').value.trim(),
    status: document.getElementById('comp-status').value,
    date: document.getElementById('comp-date').value || null,
    selectedOption: document.getElementById('comp-selected-option').value,
    notes: document.getElementById('comp-notes').value.trim(),

    p1: {
      name: document.getElementById('comp-p1-name').value.trim(),
      price: document.getElementById('comp-p1-price').value,
      time: document.getElementById('comp-p1-time').value.trim(),
      url: document.getElementById('comp-p1-pdf-data').value || document.getElementById('comp-p1-url').value.trim(),
      notes: document.getElementById('comp-p1-notes').value.trim()
    },
    p2: {
      name: document.getElementById('comp-p2-name').value.trim(),
      price: document.getElementById('comp-p2-price').value,
      time: document.getElementById('comp-p2-time').value.trim(),
      url: document.getElementById('comp-p2-pdf-data').value || document.getElementById('comp-p2-url').value.trim(),
      notes: document.getElementById('comp-p2-notes').value.trim()
    },
    p3: {
      name: document.getElementById('comp-p3-name').value.trim(),
      price: document.getElementById('comp-p3-price').value,
      time: document.getElementById('comp-p3-time').value.trim(),
      url: document.getElementById('comp-p3-pdf-data').value || document.getElementById('comp-p3-url').value.trim(),
      notes: document.getElementById('comp-p3-notes').value.trim()
    }
  };

  try {
    const response = await fetch(`${API_URL}/compras`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      await loadDataFromDB();
      closeCompraForm();
    } else {
      alert('Error al registrar la compra en la base de datos MySQL.');
    }
  } catch (err) {
    console.error('Error al guardar la compra:', err);
  }
}

// --- CORTE POR FECHAS Y REPORTES ---
function initCorteDates() {
  const today = new Date().toISOString().split('T')[0];
  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  if (!document.getElementById('corte-start-date').value) {
    document.getElementById('corte-start-date').value = firstDay;
  }
  if (!document.getElementById('corte-end-date').value) {
    document.getElementById('corte-end-date').value = today;
  }
  generateCorte();
}

function generateCorte() {
  const startDate = document.getElementById('corte-start-date').value;
  const endDate = document.getElementById('corte-end-date').value;
  const branch = document.getElementById('corte-branch').value;

  if (!startDate || !endDate) {
    alert('Por favor selecciona un rango de fechas válido.');
    return;
  }

  corteFilteredData = activities.filter(a => {
    const actDate = a.detectionDate || a.dueDate;
    const matchesDate = actDate >= startDate && actDate <= endDate;
    const matchesBranch = branch === 'Todas' || a.branch === branch;
    return matchesDate && matchesBranch;
  });

  const total = corteFilteredData.length;
  const completed = corteFilteredData.filter(a => a.status === 'Completada');
  const completedCount = completed.length;

  let totalDays = 0;
  let countWithDates = 0;

  completed.forEach(a => {
    if (a.detectionDate && a.dueDate) {
      const d1 = new Date(a.detectionDate);
      const d2 = new Date(a.dueDate);
      const diffDays = Math.max(0, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
      totalDays += diffDays;
      countWithDates++;
    }
  });

  const avgDays = countWithDates > 0 ? (totalDays / countWithDates).toFixed(1) : '0';
  const pct = total > 0 ? ((completedCount / total) * 100).toFixed(1) : '0';

  document.getElementById('corte-total').innerText = total;
  document.getElementById('corte-completed').innerText = completedCount;
  document.getElementById('corte-avg-days').innerText = `${avgDays} días`;
  document.getElementById('corte-pct').innerText = `${pct}%`;
  document.getElementById('corte-table-title').innerText = `CORTE DE ACTIVIDADES DEL ${startDate} AL ${endDate} (${branch})`;

  const tbody = document.getElementById('corte-table-body');
  tbody.innerHTML = '';

  if (corteFilteredData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 20px;">No se encontraron actividades en este período.</td></tr>`;
    return;
  }

  corteFilteredData.forEach(a => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>#${String(a.id).padStart(5, '0')}</td>
      <td>${a.detectionDate}</td>
      <td>${a.dueDate || '-'}</td>
      <td><strong>${a.branch}</strong></td>
      <td>${a.category}</td>
      <td>${a.equipment}</td>
      <td>${a.problem}</td>
      <td>${a.action || 'En atención'}</td>
      <td><span class="card-badge" style="background:${STATUS_COLORS[a.status] || '#000'}">${a.status}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function downloadCorteExcel() {
  if (corteFilteredData.length === 0) {
    alert('No hay actividades en el corte para exportar.');
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
  csvContent += "Folio,Fecha Deteccion,Fecha Cierre,Sucursal,Categoria,Tipo Trabajo,Equipo,Problema,Solucion,Estatus,Avance\n";

  corteFilteredData.forEach(a => {
    const row = [
      `"#${String(a.id).padStart(5, '0')}"`,
      `"${a.detectionDate}"`,
      `"${a.dueDate || ''}"`,
      `"${a.branch}"`,
      `"${a.category}"`,
      `"${a.workType}"`,
      `"${a.equipment.replace(/"/g, '""')}"`,
      `"${a.problem.replace(/"/g, '""')}"`,
      `"${(a.action || '').replace(/"/g, '""')}"`,
      `"${a.status}"`,
      `"${a.progress}%"`
    ].join(",");
    csvContent += row + "\n";
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Corte_Sistemas_El_Rey_${document.getElementById('corte-start-date').value}_al_${document.getElementById('corte-end-date').value}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function downloadCortePDF() {
  if (corteFilteredData.length === 0) {
    alert('No hay datos en el corte para exportar a PDF.');
    return;
  }
  window.print();
}

function renderHistory() {
  const search = document.getElementById('history-search').value.toLowerCase();
  const container = document.getElementById('history-list');
  container.innerHTML = '';

  historyLogs.slice().reverse().filter(log => 
    String(log.activityId).includes(search) || log.description.toLowerCase().includes(search) || log.branch.toLowerCase().includes(search)
  ).forEach(log => {
    const div = document.createElement('div');
    div.className = 'activity-card';
    div.innerHTML = `
      <div class="card-top">
        <span>${log.date} &bull; #${String(log.activityId).padStart(5, '0')} ${log.branch}</span>
        <span>${log.status} (${log.progress}%)</span>
      </div>
      <div class="card-problem">${log.description}</div>
    `;
    container.appendChild(div);
  });
}

function renderReport() {
  const total = activities.length || 1;
  const completed = activities.filter(a => a.status === 'Completada');
  const doneCount = completed.length;
  const efficiency = ((doneCount / total) * 100).toFixed(1);
  const preventiveCount = activities.filter(a => a.workType === 'Preventivo' || a.category === 'Mantenimiento' || a.category === 'Mejora').length;
  const preventivePct = ((preventiveCount / total) * 100).toFixed(0);

  let totalDays = 0;
  let countWithDates = 0;

  completed.forEach(a => {
    if (a.detectionDate && a.dueDate) {
      const d1 = new Date(a.detectionDate);
      const d2 = new Date(a.dueDate);
      const diffDays = Math.max(0, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
      totalDays += diffDays;
      countWithDates++;
    }
  });

  const avgDays = countWithDates > 0 ? (totalDays / countWithDates).toFixed(1) : '1.0';

  document.getElementById('rep-efficiency').innerText = `${efficiency}%`;
  document.getElementById('rep-response-time').innerText = `${avgDays} días`;
  document.getElementById('rep-preventive-pct').innerText = `${preventivePct}%`;
  document.getElementById('rep-solved').innerText = `${doneCount} de ${total}`;

  const branches = ['Alcalde', 'Escobedo', 'Saucito', 'Pozos', 'B. Anaya', 'Corporativo', 'CPYD'];
  const branchData = branches.map(b => activities.filter(a => a.branch === b).length);

  if (chartBranchesInstance) chartBranchesInstance.destroy();
  chartBranchesInstance = new Chart(document.getElementById('chartBranches'), {
    type: 'bar',
    data: {
      labels: branches,
      datasets: [{ label: 'Atenciones Registradas', data: branchData, backgroundColor: '#0868BD' }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  const statusCounts = { 'Completada': 0, 'Pendiente': 0, 'En proceso': 0, 'En espera': 0, 'Cancelada': 0 };
  activities.forEach(a => statusCounts[a.status] = (statusCounts[a.status] || 0) + 1);

  if (chartStatusInstance) chartStatusInstance.destroy();
  chartStatusInstance = new Chart(document.getElementById('chartStatus'), {
    type: 'doughnut',
    data: {
      labels: Object.keys(statusCounts),
      datasets: [{ data: Object.values(statusCounts), backgroundColor: ['#20B66B', '#FFD21C', '#36A9F5', '#F28A24', '#6B7F99'] }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  const categoryCounts = {};
  activities.forEach(a => categoryCounts[a.category] = (categoryCounts[a.category] || 0) + 1);

  if (chartCategoriesInstance) chartCategoriesInstance.destroy();
  chartCategoriesInstance = new Chart(document.getElementById('chartCategories'), {
    type: 'pie',
    data: {
      labels: Object.keys(categoryCounts),
      datasets: [{ data: Object.values(categoryCounts), backgroundColor: ['#7650D8', '#36A9F5', '#FFD21C', '#20B66B', '#E92E3D', '#F28A24'] }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  const workTypeCounts = { 'Correctivo': 0, 'Preventivo': 0, 'Evolutivo': 0, 'No aplica': 0 };
  activities.forEach(a => workTypeCounts[a.workType] = (workTypeCounts[a.workType] || 0) + 1);

  if (chartWorkTypesInstance) chartWorkTypesInstance.destroy();
  chartWorkTypesInstance = new Chart(document.getElementById('chartWorkTypes'), {
    type: 'bar',
    data: {
      labels: Object.keys(workTypeCounts),
      datasets: [{ label: 'Tipo de Mantenimiento / Atención', data: Object.values(workTypeCounts), backgroundColor: ['#E92E3D', '#20B66B', '#36A9F5', '#6B7F99'] }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

function exportJSON() {
  const backupData = { activities, historyLogs, compras };
  const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Respaldo_Sistemas_El_Rey_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
}

function importJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data.activities || data.compras) {
        
        // Enviar todo el objeto importado a la API para guardarlo en MySQL
        const response = await fetch(`${API_URL}/importar-backup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (response.ok) {
          alert('¡Respaldo importado e insertado correctamente en la base de datos MySQL!');
          await loadDataFromDB();
          showView('home');
        } else {
          const errData = await response.json();
          alert('Error al guardar el respaldo en la base de datos: ' + errData.error);
        }
      } else {
        alert('El archivo JSON no coincide con el formato de respaldo.');
      }
    } catch (err) {
      console.error(err);
      alert('Error al procesar la estructura del archivo JSON.');
    }
  };
  reader.readAsText(file);
}
// Inicialización de escuchadores y autenticación
setupPdfListeners();
checkAuth();