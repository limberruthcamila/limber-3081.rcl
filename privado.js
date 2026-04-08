/* ============================================================
   PANEL ADMIN - LÓGICA PRIVADA
   Firebase Auth (Google) + Firestore CRUD + Dashboard
   ============================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyBFu8Jrd2YrBTMuikiuCnOj7dyHMugHx-0",
  authDomain: "limber-rcl-3081.firebaseapp.com",
  projectId: "limber-rcl-3081",
  storageBucket: "limber-rcl-3081.firebasestorage.app",
  messagingSenderId: "258409264111",
  appId: "1:258409264111:web:08fa48d8bb10ab83c07c1a",
  measurementId: "G-CVGEW1HQEZ"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ---- DOM ----
const loginScreen = document.getElementById('login-screen');
const adminPanel = document.getElementById('admin-panel');
const loginError = document.getElementById('login-error');
const loginErrorText = document.getElementById('login-error-text');

// ---- AUTH ----
document.getElementById('btn-google-login').addEventListener('click', async () => {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        await auth.signInWithPopup(provider);
    } catch (e) {
        showLoginError('Error al iniciar sesión: ' + e.message);
    }
});

auth.onAuthStateChanged(async (user) => {
    if (user) {
        const authorized = await checkAuthorization(user);
        if (authorized) {
            showAdmin(user);
        } else {
            showLoginError('Tu cuenta no está autorizada. Contacta al administrador.');
            auth.signOut();
        }
    } else {
        loginScreen.style.display = 'flex';
        adminPanel.style.display = 'none';
    }
});

async function checkAuthorization(user) {
    try {
        // Check in privado collection by UID
        const docRef = await db.collection('privado').doc(user.uid).get();
        if (docRef.exists) return true;

        // Also check by email field
        const query = await db.collection('privado').where('email', '==', user.email).get();
        if (!query.empty) return true;

        return false;
    } catch (e) {
        console.error('Auth check error:', e);
        return false;
    }
}

function showLoginError(msg) {
    loginError.style.display = 'flex';
    loginErrorText.textContent = msg;
    setTimeout(() => { loginError.style.display = 'none'; }, 5000);
}

function showAdmin(user) {
    loginScreen.style.display = 'none';
    adminPanel.style.display = 'flex';

    document.getElementById('sidebar-name').textContent = user.displayName || 'Admin';
    document.getElementById('sidebar-email').textContent = user.email;
    const avatar = document.getElementById('sidebar-avatar');
    if (user.photoURL) {
        avatar.src = user.photoURL;
        avatar.style.display = 'block';
    }

    loadDashboard();
    loadProjects();
    loadMessages();
    loadAuthorizedUsers();
}

document.getElementById('btn-logout').addEventListener('click', () => auth.signOut());

// ---- SIDEBAR NAVIGATION ----
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebarClose = document.getElementById('sidebar-close');

sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
sidebarClose.addEventListener('click', () => sidebar.classList.remove('open'));

document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const section = link.dataset.section;

        document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        document.getElementById(`section-${section}`).classList.add('active');

        document.getElementById('top-bar-title').textContent = link.textContent.trim();
        sidebar.classList.remove('open');
    });
});

// ---- DASHBOARD ----
async function loadDashboard() {
    try {
        const statsDoc = await db.collection('stats').doc('general').get();
        if (statsDoc.exists) {
            const data = statsDoc.data();
            document.getElementById('dash-visits').textContent = (data.totalVisits || 0).toLocaleString();
            const clicks = data.clicks || {};
            document.getElementById('dash-whatsapp').textContent = (clicks.whatsapp || 0).toLocaleString();
            document.getElementById('dash-github').textContent = (clicks.github || 0).toLocaleString();
            document.getElementById('dash-youtube').textContent = (clicks.youtube || 0).toLocaleString();

            renderChart(clicks);
        }

        // Popular projects
        const projects = await db.collection('projects').orderBy('views', 'desc').limit(5).get();
        const container = document.getElementById('popular-projects');
        container.innerHTML = '';
        if (projects.empty) {
            container.innerHTML = '<p class="no-data">Sin datos aún</p>';
            return;
        }
        projects.forEach(doc => {
            const d = doc.data();
            container.innerHTML += `
                <div class="popular-item">
                    <span class="popular-name">${escapeHTML(d.title)}</span>
                    <span class="popular-views"><i class="fas fa-eye"></i> ${d.views || 0}</span>
                </div>
            `;
        });
    } catch (e) {
        console.error('Dashboard error:', e);
    }
}

function renderChart(clicks) {
    const container = document.getElementById('chart-bars');
    const items = [
        { label: 'WhatsApp', value: clicks.whatsapp || 0, color: '#25d366' },
        { label: 'GitHub', value: clicks.github || 0, color: '#333' },
        { label: 'YouTube', value: clicks.youtube || 0, color: '#ff0000' }
    ];
    const max = Math.max(...items.map(i => i.value), 1);

    container.innerHTML = items.map(item => `
        <div class="bar-item">
            <div class="bar-label">${item.label}</div>
            <div class="bar-track">
                <div class="bar-fill" style="width:${(item.value / max) * 100}%;background:${item.color};"></div>
            </div>
            <div class="bar-value">${item.value}</div>
        </div>
    `).join('');
}

// ---- PROJECTS CRUD ----
let editingId = null;
const modal = document.getElementById('project-modal');
const projectForm = document.getElementById('project-form');

document.getElementById('btn-add-project').addEventListener('click', () => {
    editingId = null;
    document.getElementById('modal-title').textContent = 'Nuevo Proyecto';
    projectForm.reset();
    modal.style.display = 'flex';
});

document.getElementById('modal-close').addEventListener('click', () => modal.style.display = 'none');
document.getElementById('btn-cancel').addEventListener('click', () => modal.style.display = 'none');
modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

projectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        title: document.getElementById('project-title').value.trim(),
        description: document.getElementById('project-desc').value.trim(),
        image: document.getElementById('project-image').value.trim(),
        link: document.getElementById('project-link').value.trim(),
    };

    try {
        if (editingId) {
            await db.collection('projects').doc(editingId).update(data);
            showToast('Proyecto actualizado');
        } else {
            data.views = 0;
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('projects').add(data);
            showToast('Proyecto creado');
        }
        modal.style.display = 'none';
        loadProjects();
        loadDashboard();
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
});

async function loadProjects() {
    const tbody = document.getElementById('projects-tbody');
    const empty = document.getElementById('table-empty');
    try {
        const snapshot = await db.collection('projects').orderBy('createdAt', 'desc').get();
        tbody.innerHTML = '';
        if (snapshot.empty) {
            empty.style.display = 'block';
            return;
        }
        empty.style.display = 'none';
        snapshot.forEach(doc => {
            const d = doc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="project-cell">
                        ${d.image ? `<img src="${d.image}" class="project-thumb">` : '<div class="project-thumb-placeholder"><i class="fas fa-image"></i></div>'}
                        <strong>${escapeHTML(d.title)}</strong>
                    </div>
                </td>
                <td class="desc-cell">${escapeHTML(d.description || '').substring(0, 80)}...</td>
                <td><span class="views-badge"><i class="fas fa-eye"></i> ${d.views || 0}</span></td>
                <td>
                    <div class="action-btns">
                        <button class="btn-edit" onclick="editProject('${doc.id}')"><i class="fas fa-edit"></i></button>
                        <button class="btn-delete" onclick="deleteProject('${doc.id}', '${escapeHTML(d.title)}')"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error('Load projects error:', e);
    }
}

window.editProject = async function(id) {
    try {
        const doc = await db.collection('projects').doc(id).get();
        if (!doc.exists) return;
        const d = doc.data();
        editingId = id;
        document.getElementById('modal-title').textContent = 'Editar Proyecto';
        document.getElementById('project-title').value = d.title || '';
        document.getElementById('project-desc').value = d.description || '';
        document.getElementById('project-image').value = d.image || '';
        document.getElementById('project-link').value = d.link || '';
        modal.style.display = 'flex';
    } catch (e) {
        showToast('Error al cargar proyecto', 'error');
    }
};

window.deleteProject = async function(id, title) {
    if (!confirm(`¿Eliminar "${title}"?`)) return;
    try {
        await db.collection('projects').doc(id).delete();
        showToast('Proyecto eliminado');
        loadProjects();
        loadDashboard();
    } catch (e) {
        showToast('Error al eliminar', 'error');
    }
};

// ---- MESSAGES ----
async function loadMessages() {
    const container = document.getElementById('messages-list');
    const empty = document.getElementById('messages-empty');
    try {
        const snapshot = await db.collection('messages').orderBy('createdAt', 'desc').get();
        container.innerHTML = '';
        if (snapshot.empty) {
            empty.style.display = 'block';
            return;
        }
        empty.style.display = 'none';
        snapshot.forEach(doc => {
            const d = doc.data();
            const date = d.createdAt ? new Date(d.createdAt.seconds * 1000).toLocaleDateString('es') : 'Sin fecha';
            container.innerHTML += `
                <div class="message-card">
                    <div class="message-header">
                        <strong>${escapeHTML(d.name)}</strong>
                        <span class="message-date">${date}</span>
                    </div>
                    <span class="message-email">${escapeHTML(d.email)}</span>
                    <p>${escapeHTML(d.message)}</p>
                    <button class="btn-delete-msg" onclick="deleteMessage('${doc.id}')"><i class="fas fa-trash"></i> Eliminar</button>
                </div>
            `;
        });
    } catch (e) {
        console.error('Messages error:', e);
    }
}

window.deleteMessage = async function(id) {
    if (!confirm('¿Eliminar este mensaje?')) return;
    try {
        await db.collection('messages').doc(id).delete();
        showToast('Mensaje eliminado');
        loadMessages();
    } catch (e) {
        showToast('Error', 'error');
    }
};

// ---- AUTHORIZED USERS ----
async function loadAuthorizedUsers() {
    const container = document.getElementById('auth-users-list');
    try {
        const snapshot = await db.collection('privado').get();
        container.innerHTML = '';
        snapshot.forEach(doc => {
            const d = doc.data();
            container.innerHTML += `
                <div class="auth-user-item">
                    <i class="fas fa-user-check"></i>
                    <div>
                        <strong>${escapeHTML(d.displayName || 'Sin nombre')}</strong>
                        <span>${escapeHTML(d.email || doc.id)}</span>
                    </div>
                </div>
            `;
        });
        if (snapshot.empty) {
            container.innerHTML = '<p class="no-data">No hay usuarios autorizados. Agrega un documento en la colección "privado" con el UID del usuario como ID.</p>';
        }
    } catch (e) {
        container.innerHTML = '<p class="no-data">Error al cargar usuarios</p>';
    }
}

// ---- TOAST ----
function showToast(msg, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${msg}`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}
