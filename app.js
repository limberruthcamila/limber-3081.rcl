/* ============================================================
   PORTAFOLIO LIMBER HUAYCHO - LÓGICA PÚBLICA
   Firebase Firestore + Analytics + Interactividad
   ============================================================ */

// Firebase Config
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
const db = firebase.firestore();

// ---- DOM ELEMENTS ----
const navbar = document.getElementById('navbar');
const navToggle = document.getElementById('navToggle');
const navMenu = document.getElementById('navMenu');
const scrollTopBtn = document.getElementById('scrollTop');
const projectsGrid = document.getElementById('projects-grid');
const projectsLoader = document.getElementById('projects-loader');
const projectsEmpty = document.getElementById('projects-empty');

// ---- NAVIGATION ----
navToggle.addEventListener('click', () => {
    navToggle.classList.toggle('active');
    navMenu.classList.toggle('active');
});

document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        navToggle.classList.remove('active');
        navMenu.classList.remove('active');
    });
});

// Navbar scroll effect
let lastScroll = 0;
window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    navbar.classList.toggle('scrolled', scrollY > 50);
    scrollTopBtn.classList.toggle('visible', scrollY > 400);

    // Active nav link
    document.querySelectorAll('section[id]').forEach(section => {
        const top = section.offsetTop - 100;
        const height = section.offsetHeight;
        const id = section.getAttribute('id');
        const link = document.querySelector(`.nav-link[href="#${id}"]`);
        if (link) {
            link.classList.toggle('active', scrollY >= top && scrollY < top + height);
        }
    });

    lastScroll = scrollY;
});

// Scroll to top
scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ---- SCROLL ANIMATIONS ----
const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -50px 0px' };
const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
            setTimeout(() => {
                entry.target.classList.add('visible');
            }, index * 100);
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));

// ---- VISIT COUNTER ----
async function trackVisit() {
    try {
        const statsRef = db.collection('stats').doc('general');
        const doc = await statsRef.get();
        if (doc.exists) {
            await statsRef.update({
                totalVisits: firebase.firestore.FieldValue.increment(1)
            });
            const visits = doc.data().totalVisits + 1;
            const el = document.getElementById('stat-visits');
            if (el) animateCounter(el, visits);
        } else {
            await statsRef.set({
                totalVisits: 1,
                clicks: { whatsapp: 0, github: 0, youtube: 0 }
            });
            const el = document.getElementById('stat-visits');
            if (el) el.textContent = '1';
        }
    } catch (e) {
        console.log('Stats:', e.message);
    }
}

function animateCounter(element, target) {
    let current = 0;
    const step = Math.ceil(target / 40);
    const interval = setInterval(() => {
        current += step;
        if (current >= target) {
            current = target;
            clearInterval(interval);
        }
        element.textContent = current.toLocaleString();
    }, 30);
}

// ---- CLICK TRACKING ----
async function trackClick(type) {
    try {
        const statsRef = db.collection('stats').doc('general');
        await statsRef.update({
            [`clicks.${type}`]: firebase.firestore.FieldValue.increment(1)
        });
    } catch (e) {
        console.log('Click track:', e.message);
    }
}

// Track social buttons
document.querySelectorAll('[id^="btn-"], [id^="contact-"]').forEach(btn => {
    btn.addEventListener('click', () => {
        const id = btn.id;
        if (id.includes('whatsapp')) trackClick('whatsapp');
        else if (id.includes('github')) trackClick('github');
        else if (id.includes('youtube')) trackClick('youtube');
    });
});

// ---- LOAD PROJECTS ----
const gradients = ['gradient-1', 'gradient-2', 'gradient-3', 'gradient-4', 'gradient-5'];
const icons = ['fa-shopping-cart', 'fa-gamepad', 'fa-store', 'fa-code', 'fa-mobile-alt', 'fa-globe'];

async function loadProjects() {
    try {
        const snapshot = await db.collection('projects').orderBy('createdAt', 'desc').get();
        
        projectsLoader.style.display = 'none';

        if (snapshot.empty) {
            projectsEmpty.style.display = 'block';
            const el = document.getElementById('stat-projects');
            if (el) el.textContent = '0';
            return;
        }

        const el = document.getElementById('stat-projects');
        if (el) animateCounter(el, snapshot.size);

        snapshot.forEach((doc, index) => {
            const data = doc.data();
            const gradientClass = gradients[index % gradients.length];
            const iconClass = icons[index % icons.length];

            const card = document.createElement('div');
            card.className = 'project-card animate-on-scroll';

            const imageHTML = data.image
                ? `<img src="${data.image}" alt="${data.title}" class="project-card-image" loading="lazy">`
                : `<div class="project-placeholder-img ${gradientClass}"><i class="fas ${iconClass}"></i></div>`;

            card.innerHTML = `
                <div class="project-card-image-wrapper">
                    ${imageHTML}
                    <span class="project-card-badge">Proyecto</span>
                </div>
                <div class="project-card-body">
                    <h3>${escapeHTML(data.title || 'Sin título')}</h3>
                    <p>${escapeHTML(data.description || 'Sin descripción')}</p>
                    ${data.link ? `<a href="${escapeHTML(data.link)}" target="_blank" class="project-card-link" onclick="trackProjectClick('${doc.id}')"><i class="fas fa-external-link-alt"></i> Ver proyecto</a>` : ''}
                    <div class="project-card-views"><i class="fas fa-eye"></i> <span>${data.views || 0} vistas</span></div>
                </div>
            `;

            projectsGrid.appendChild(card);
            // Re-observe for animation
            setTimeout(() => observer.observe(card), 50);
        });

    } catch (e) {
        console.error('Error loading projects:', e);
        projectsLoader.innerHTML = '<p>Error al cargar proyectos</p>';
    }
}

// Track project click
async function trackProjectClick(projectId) {
    try {
        await db.collection('projects').doc(projectId).update({
            views: firebase.firestore.FieldValue.increment(1)
        });
    } catch (e) {
        console.log('Project click:', e.message);
    }
}

// Make it global
window.trackProjectClick = trackProjectClick;

// ---- CONTACT FORM ---- 
const contactForm = document.getElementById('contact-form');
if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const message = document.getElementById('message').value.trim();

        if (!name || !email || !message) {
            showToast('Por favor completa todos los campos', 'error');
            return;
        }

        try {
            await db.collection('messages').add({
                name, email, message,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('¡Mensaje enviado correctamente!', 'success');
            contactForm.reset();
        } catch (e) {
            showToast('Error al enviar el mensaje', 'error');
        }
    });
}

// ---- TOAST ----
function showToast(msg, type = '') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${msg}`;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ---- UTILITY ----
function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
    trackVisit();
    loadProjects();
});
