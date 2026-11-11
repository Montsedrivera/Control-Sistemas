const DEPARTAMENTOS = [
  { id: 'elrey_direccion', nombre: 'Dirección', icon: '📊', desc: 'Indicadores ejecutivos y planeación estratégica' },
  { id: 'elrey_administracion', nombre: 'Administración', icon: '💼', desc: 'Gestión de facturas, caja chica y gastos' },
  { id: 'elrey_sistemas', nombre: 'Sistemas', icon: '💻', desc: 'Control de incidentes, equipos, compras e inventario' },
  { id: 'elrey_comercializacion', nombre: 'Comercialización', icon: '📈', desc: 'Campañas, promociones y atención a sucursales' },
  { id: 'elrey_operaciones', nombre: 'Operaciones', icon: '⚙️', desc: 'Mantenimiento de sucursales y logística' },
  { id: 'elrey_desarrollo_humano', nombre: 'Desarrollo Humano', icon: '👥', desc: 'Gestión de personal y capacitaciones' }
];

const MOCK_USERS = {
  'admin': { nombre: 'Administrador General', perfil: 'Administrador', es_superadmin: true, esquema: null },
  'user_sistemas': { nombre: 'Encargado Sistemas', perfil: 'Sistemas', es_superadmin: false, esquema: 'elrey_sistemas' },
  'user_admin': { nombre: 'Encargado Administración', perfil: 'Administración', es_superadmin: false, esquema: 'elrey_administracion' }
};

let currentSession = null;

function handleLogin(e) {
  e.preventDefault();
  const userVal = document.getElementById('login-user').value.trim();
  const passVal = document.getElementById('login-pass').value.trim();
  const errorEl = document.getElementById('login-error');

  if (MOCK_USERS[userVal] && (passVal === 'admin123' || passVal === 'pass123')) {
    currentSession = MOCK_USERS[userVal];
    currentSession.username = userVal;
    
    document.getElementById('login-screen').style.display = 'none';
    showDeptSelector();
  } else {
    errorEl.style.display = 'block';
  }
}

function handleLogout() {
  currentSession = null;
  document.getElementById('app-container').style.display = 'none';
  document.getElementById('dept-selector-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
}

function showDeptSelector() {
  document.getElementById('dept-selector-screen').style.display = 'flex';
  document.getElementById('selector-user-display').textContent = currentSession.nombre;
  document.getElementById('selector-role-display').textContent = currentSession.perfil;

  const grid = document.getElementById('dept-grid');
  grid.innerHTML = '';

  DEPARTAMENTOS.forEach(dept => {
    const isAllowed = currentSession.es_superadmin || currentSession.esquema === dept.id;
    const card = document.createElement('div');
    card.className = `dept-card ${isAllowed ? 'enabled' : 'disabled'}`;
    
    card.innerHTML = `
      <div class="dept-icon">${dept.icon}</div>
      <h3>${dept.nombre}</h3>
      <p>${dept.desc}</p>
      <span class="dept-badge ${isAllowed ? 'badge-enabled' : 'badge-disabled'}">
        ${isAllowed ? 'Acceso Permitido ✓' : 'Restringido 🔒'}
      </span>
    `;

    if (isAllowed) {
      card.addEventListener('click', () => openDepartmentModule(dept));
    }

    grid.appendChild(card);
  });
}

function openDepartmentModule(dept) {
  document.getElementById('dept-selector-screen').style.display = 'none';
  document.getElementById('app-container').style.display = 'flex';

  const backBtn = document.getElementById('btn-back-selector');
  if (currentSession.es_superadmin) {
    backBtn.style.display = 'inline-block';
  } else {
    backBtn.style.display = 'none';
  }

  document.getElementById('dept-module-title').textContent = `CONTROL DE DEPARTAMENTO DE ${dept.nombre.toUpperCase()}`;
  document.getElementById('sidebar-dept-name').textContent = `Control de ${dept.nombre}`;
  document.getElementById('current-user-display').textContent = currentSession.nombre;
  document.getElementById('footer-db-name').textContent = dept.id;
  document.getElementById('home-welcome-msg').textContent = `¡Hola! Panel General del Área de ${dept.nombre}.`;
}

function returnToSelector() {
  document.getElementById('app-container').style.display = 'none';
  showDeptSelector();
}

function openDepartmentModule(dept) {
  // Redirecciona directamente a la carpeta del departamento seleccionado
  if (dept.id === 'elrey_sistemas') {
    window.location.href = 'modulos/sistemas/index.html';
  } else {
    alert(`Redireccionando al módulo de ${dept.nombre}...`);
  }
}