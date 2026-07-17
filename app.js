let allGames = [];          
let displayedGames = [];    
const GAMES_PER_PAGE = 16;   // 16 jeux par page
let currentPage = 1;
let currentCategory = 'home'; // Par défaut sur la page Accueil dédiée

let lastScrollY = window.scrollY;
let accumulatedScroll = 0;

// --- VARIABLES DU CARROUSEL AVEC PROGRESSION & STOPOVER ---
let carouselGames = [];
let currentCarouselIndex = 0;
let progressInterval = null;
let currentProgress = 0;
let isCarouselHovered = false;
const CAROUSEL_DURATION = 15000; // 15 secondes
const PROGRESS_STEP = 50; // (Utilisé pour le calcul interne si nécessaire)

const fichiersPlateformes = {
    'home': 'jeux.json',
    'all': 'jeux.json',
    'GOG': 'jeux.json',
    'Repacks': 'jeux.json',
    'PS4': 'ps4.json'
};

/* --- SYSTEME LOCALSTORAGE : GESTION DE LA WISHLIST (MA LISTE) --- */
function getWishlist() {
    const list = localStorage.getItem('sk_fgames_wishlist');
    return list ? JSON.parse(list) : [];
}

function saveWishlist(list) {
    localStorage.setItem('sk_fgames_wishlist', JSON.stringify(list));
}

function toggleWishlist(game) {
    let wishlist = getWishlist();
    const index = wishlist.findIndex(item => item.nom === game.nom);

    if (index === -1) {
        wishlist.push(game);
    } else {
        wishlist.splice(index, 1);
    }
    
    saveWishlist(wishlist);

    if (currentCategory === 'wishlist') {
        applyFilters();
    }
}

/* --- SEED COMPATIBLE : ALGORITHME DE MÉLANGE QUOTIDIEN --- */
function shuffleByDay(array) {
    const today = new Date();
    const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    
    let currentIndex = array.length, temporaryValue, randomIndex;
    let currentSeed = seed;

    function random() {
        let x = Math.sin(currentSeed++) * 10000;
        return x - Math.floor(x);
    }

    while (0 !== currentIndex) {
        randomIndex = Math.floor(random() * currentIndex);
        currentIndex -= 1;
        
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }
    return array;
}

/* --- LOGIQUE DU COMPOSANT DROPDOWN CUSTOMISÉ --- */
const dropdown = document.getElementById('category-dropdown');
const dropdownBtn = document.getElementById('dropdown-btn');
const selectedValueSpan = document.getElementById('selected-value');
const navWishlistTrigger = document.getElementById('nav-wishlist-trigger');

dropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
});

document.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.stopPropagation();
        
        document.querySelector('.dropdown-item.active').classList.remove('active');
        item.classList.add('active');
        
        if (navWishlistTrigger) {
            navWishlistTrigger.classList.remove('active');
        }
        
        selectedValueSpan.textContent = item.textContent;
        currentCategory = item.getAttribute('data-value');
        
        fetchGames();
        dropdown.classList.remove('open');
    });
});

document.addEventListener('click', () => {
    dropdown.classList.remove('open');
});

/* --- EVENEMENT CLIC SUR LE BOUTON "MA LISTE" --- */
if (navWishlistTrigger) {
    navWishlistTrigger.addEventListener('click', () => {
        if (navWishlistTrigger.classList.contains('active')) {
            navWishlistTrigger.classList.remove('active');
            
            const defaultItem = document.querySelector('.dropdown-item[data-value="home"]');
            document.querySelectorAll('.dropdown-item').forEach(el => el.classList.remove('active'));
            defaultItem.classList.add('active');
            
            selectedValueSpan.textContent = defaultItem.textContent;
            currentCategory = 'home';
        } else {
            navWishlistTrigger.classList.add('active');
            document.querySelectorAll('.dropdown-item').forEach(el => el.classList.remove('active'));
            selectedValueSpan.textContent = "Ma Liste";
            currentCategory = 'wishlist';
        }
        fetchGames();
    });
}

/* --- GESTION DE LA LOUPE RESPONSIVE SUR MOBILE --- */
const searchToggleBtn = document.getElementById('search-toggle-btn');
const searchBox = document.getElementById('search-box');

searchToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    searchToggleBtn.classList.toggle('active');
    searchBox.classList.toggle('open');
    
    if (searchBox.classList.contains('open')) {
        document.getElementById('search-input').focus();
    }
});

searchBox.addEventListener('click', (e) => e.stopPropagation());

document.addEventListener('click', () => {
    if (window.innerWidth < 768) {
        searchToggleBtn.classList.remove('active');
        searchBox.classList.remove('open');
    }
});

/* --- FENÊTRE MODALE : LOGIQUE D'AFFICHAGE --- */
const modal = document.getElementById('config-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const tabBtns = document.querySelectorAll('.tab-btn');

closeModalBtn.addEventListener('click', () => modal.classList.remove('open'));
modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelector('.tab-btn.active').classList.remove('active');
        document.querySelector('.config-display > .active').classList.remove('active');
        
        btn.classList.add('active');
        document.getElementById(`config-${btn.getAttribute('data-tab')}`).classList.add('active');
    });
});

function openConfigModal(game, defaultTab = 'about') {
    document.getElementById('modal-game-title').textContent = game.nom;
    
    const aboutContainer = document.getElementById('config-about');
    aboutContainer.innerHTML = `
        <p style="margin-bottom: 12px;"><strong>Description :</strong> ${game.description || 'Aucune description disponible.'}</p>
        <p style="margin-bottom: 12px;"><strong>Synopsis :</strong> <em>${game.synopsis || 'Aucun synopsis renseigné.'}</em></p>
        <p><strong>Statut Linux/Proton :</strong> <span class="linux-badge ${(game.linux_status || 'unknown').toLowerCase()}" style="position:static; display:inline-block; margin-left:5px;">${game.linux_status || 'Non renseigné'}</span></p>
    `;

    const minContainer = document.getElementById('config-min');
    const recContainer = document.getElementById('config-rec');
    
    const renderList = (specs) => `
        <li><strong>Système d'exploitation</strong> ${specs.os || 'Non spécifié'}</li>
        <li><strong>Processeur</strong> ${specs.cpu || 'Non spécifié'}</li>
        <li><strong>Mémoire vive</strong> ${specs.ram || 'Non spécifié'}</li>
        <li><strong>Carte Graphique</strong> ${specs.gpu || 'Non spécifié'}</li>
        <li><strong>DirectX</strong> ${specs.dx || 'Non spécifié'}</li>
        <li><strong>Espace Disque</strong> ${specs.storage || 'Non spécifié'}</li>
    `;

    if (game.config && game.config.min && game.config.rec) {
        minContainer.innerHTML = renderList(game.config.min);
        recContainer.innerHTML = renderList(game.config.rec);
    } else {
        const fallback = `<li><strong>Information</strong> Caractéristiques non renseignées.</li>`;
        minContainer.innerHTML = fallback;
        recContainer.innerHTML = fallback;
    }
    
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.config-display > *').forEach(el => el.classList.remove('active'));
    
    document.querySelector(`.tab-btn[data-tab="${defaultTab}"]`).classList.add('active');
    document.getElementById(`config-${defaultTab}`).classList.add('active');

    modal.classList.add('open');
}

/* --- NAVBAR FIXED HIDE LOGIC --- */
window.addEventListener('scroll', () => {
    const navbar = document.getElementById('main-navbar');
    const currentScrollY = window.scrollY;
    const deltaY = currentScrollY - lastScrollY;

    if ((deltaY > 0 && accumulatedScroll < 0) || (deltaY < 0 && accumulatedScroll > 0)) {
        accumulatedScroll = 0; 
    }
    accumulatedScroll += deltaY;

    if (accumulatedScroll >= 20 && currentScrollY > 70) {
        navbar.classList.add('hidden');
        if (window.innerWidth < 768) {
            searchToggleBtn.classList.remove('active');
            searchBox.classList.remove('open');
        }
        accumulatedScroll = 0;
    } else if (accumulatedScroll <= -10 || currentScrollY <= 0) {
        navbar.classList.remove('hidden');
        accumulatedScroll = 0;
    }
    lastScrollY = currentScrollY;
});

/* --- ENGINE CARROUSEL OPTIMISÉ AVEC REQUESTANIMATIONFRAME --- */
function initHeroCarousel(games) {
    const wrapper = document.getElementById('hero-carousel-wrapper');
    
    carouselGames = games.filter(g => g.synopsis)
                         .sort(() => Math.random() - 0.5)
                         .slice(0, 10);

    if (carouselGames.length === 0 || currentCategory !== 'home') {
        wrapper.style.display = 'none';
        stopCarouselTimeline();
        return;
    }

    wrapper.style.display = 'block';
    currentCarouselIndex = 0;
    isCarouselHovered = false;
    
    setupCarouselEvents();
    startCarouselTimeline();
}

function setupCarouselEvents() {
    const container = document.getElementById('hero-carousel-wrapper');
    container.onmouseenter = () => { isCarouselHovered = true; };
    container.onmouseleave = () => { isCarouselHovered = false; };
}

function startCarouselTimeline() {
    renderCarouselCard();
    currentProgress = 0;
    
    let lastTimestamp = performance.now();
    cancelAnimationFrame(progressInterval);
    
    const animate = (timestamp) => {
        if (isCarouselHovered) {
            lastTimestamp = timestamp;
            progressInterval = requestAnimationFrame(animate);
            return;
        }

        const deltaTime = timestamp - lastTimestamp;
        lastTimestamp = timestamp;
        
        currentProgress += deltaTime;
        let percent = (currentProgress / CAROUSEL_DURATION) * 100;
        
        const progressBar = document.getElementById('carousel-progress-bar');
        if (progressBar) progressBar.style.width = `${Math.min(percent, 100)}%`;

        if (currentProgress >= CAROUSEL_DURATION) {
            currentCarouselIndex = (currentCarouselIndex + 1) % carouselGames.length;
            startCarouselTimeline();
        } else {
            progressInterval = requestAnimationFrame(animate);
        }
    };

    progressInterval = requestAnimationFrame(animate);
}

function stopCarouselTimeline() {
    cancelAnimationFrame(progressInterval);
    progressInterval = null;
}

function renderCarouselCard() {
    const container = document.getElementById('hero-carousel-container');
    if (!carouselGames[currentCarouselIndex]) return;
    
    const game = carouselGames[currentCarouselIndex];
    container.style.backgroundImage = `url('${game.image}')`;
    
    let dotsHtml = carouselGames.map((_, idx) => `
        <div class="carousel-dot ${idx === currentCarouselIndex ? 'active' : ''}" data-idx="${idx}"></div>
    `).join('');

    container.innerHTML = `
        <div class="hero-carousel-content">
            <div class="hero-carousel-tags">
                <span class="tag-version"><i class="fa-solid fa-code-branch"></i> Stable</span>
                <span class="tag-platform">PC / LINUX</span>
                <span class="linux-badge ${(game.linux_status || '').toLowerCase()}">${game.linux_status || 'Proton'}</span>
            </div>
            <h1 class="hero-carousel-title">${game.nom}</h1>
            <p class="hero-carousel-synopsis">${game.synopsis}</p>
            <div class="hero-carousel-actions">
                <a class="hero-btn-download" href="${game.lien}" target="_blank">
                    <i class="fa-solid fa-download"></i> Télécharger
                </a>
                <button class="hero-btn-details">
                    Details <i class="fa-solid fa-chevron-right" style="font-size:0.75rem;"></i>
                </button>
            </div>
        </div>
        <div class="carousel-progress-bar-container">
            <div class="carousel-progress-bar" id="carousel-progress-bar"></div>
        </div>
        <div class="carousel-dots">${dotsHtml}</div>
    `;

    container.querySelector('.hero-btn-details').onclick = () => openConfigModal(game, 'about');
    
    container.querySelectorAll('.carousel-dot').forEach(dot => {
        dot.onclick = (e) => {
            currentCarouselIndex = parseInt(e.target.getAttribute('data-idx'));
            startCarouselTimeline();
        };
    });
}

/* --- FETCH DYNAMIQUE DU JSON PAR PLATEFORME --- */
async function fetchGames() {
    if (currentCategory === 'wishlist') {
        allGames = getWishlist();
        applyFilters();
        return;
    }

    const fichierCible = fichiersPlateformes[currentCategory] || 'jeux.json';

    try {
        if (currentCategory === 'home' || currentCategory === 'all') {
            const [responsePc, responsePs4] = await Promise.all([
                fetch('jeux.json'),
                fetch('ps4.json')
            ]);
            if (!responsePc.ok || !responsePs4.ok) throw new Error("Erreur réseau globale");
            
            const jeuxPc = await responsePc.json();
            const jeuxPs4 = await responsePs4.json();
            allGames = [...jeuxPc, ...jeuxPs4];

            if (currentCategory === 'home') {
                initHeroCarousel(jeuxPc);
            } else {
                document.getElementById('hero-carousel-wrapper').style.display = 'none';
                stopCarouselTimeline();
            }
        } else {
            const response = await fetch(fichierCible);
            if (!response.ok) throw new Error("Erreur de chargement");
            allGames = await response.json();
            document.getElementById('hero-carousel-wrapper').style.display = 'none';
            stopCarouselTimeline();
        }
        applyFilters();
    } catch (error) {
        console.error("Erreur :", error);
        document.getElementById('games-container').innerHTML = `
            <div class="alert-container"><p class="alert-text">Impossible de charger la base de données des jeux.</p></div>
        `;
        document.getElementById('pagination-container').style.display = 'none';
    }
}

/* ACCÈS ET CALCUL DE LA SÉLECTION FILTRÉE --- */
function getFilteredSource() {
    const searchString = document.getElementById('search-input').value.toLowerCase().trim();

    let source = allGames.filter(game => {
        const matchesSearch = game.nom.toLowerCase().includes(searchString);
        let matchesCategory = true;
        if (currentCategory === 'GOG' || currentCategory === 'Repacks') {
            matchesCategory = game.categorie.toLowerCase() === currentCategory.toLowerCase();
        } else if (currentCategory === 'ps4') {
            matchesCategory = true;
        }
        return matchesSearch && matchesCategory;
    });

    if (currentCategory === 'home' && searchString === '') {
        source = shuffleByDay([...source]);
    } 
    else if (currentCategory === 'all' && searchString === '') {
        source = [...source].sort(() => Math.random() - 0.7);
    }

    const wrapper = document.getElementById('hero-carousel-wrapper');
    if (wrapper) {
        if (searchString !== '' || currentCategory !== 'home') {
            wrapper.style.display = 'none';
            stopCarouselTimeline();
        } else if (currentCategory === 'home' && carouselGames.length > 0) {
            wrapper.style.display = 'block';
        }
    }

    return source;
}

/* SYSTEME DE RENDER ET FILTRAGE CENTRALISÉ */
function applyFilters() {
    currentPage = 1;
    showPage(currentPage);
}

function showPage(page) {
    const filteredSource = getFilteredSource();
    
    if (currentCategory === 'home') {
        displayedGames = filteredSource.slice(0, 16);
        renderGames(displayedGames);
        document.getElementById('pagination-container').style.display = 'none';
        return;
    }

    const totalPages = Math.ceil(filteredSource.length / GAMES_PER_PAGE);
    if (page < 1) page = 1;
    if (page > totalPages && totalPages > 0) page = totalPages;
    currentPage = page;

    const startIndex = (currentPage - 1) * GAMES_PER_PAGE;
    const endIndex = startIndex + GAMES_PER_PAGE;
    displayedGames = filteredSource.slice(startIndex, endIndex);

    renderGames(displayedGames);
    renderPagination(totalPages);
}

function renderGames(gamesList) {
    const container = document.getElementById('games-container');
    container.innerHTML = ''; 

    if (gamesList.length === 0) {
        container.innerHTML = `<div class="alert-container"><p class="alert-text">Aucun jeu trouvé.</p></div>`;
        return;
    }
    appendGames(gamesList);
}

function appendGames(gamesList) {
    const container = document.getElementById('games-container');
    const template = document.getElementById('game-card-template');
    const wishlist = getWishlist();

    gamesList.forEach(game => {
        const clone = template.content.cloneNode(true);
        clone.querySelector('.game-img').src = game.image;
        clone.querySelector('.game-img').alt = game.nom;
        clone.querySelector('.game-title').textContent = game.nom;
        clone.querySelector('.game-category').textContent = game.categorie;
        clone.querySelector('.download-btn').href = game.lien;
        
        if(game.date_sortie) {
            clone.querySelector('.game-release-date').textContent = game.date_sortie.split('-')[0];
        }

        const badge = clone.getElementById('card-linux-badge');
        if(game.linux_status) {
            badge.textContent = game.linux_status;
            badge.className = `linux-badge ${game.linux_status.toLowerCase()}`;
        } else {
            badge.style.display = 'none';
        }
        
        const isFav = wishlist.some(item => item.nom === game.nom);
        const wishBtn = clone.querySelector('.wishlist-btn');
        if (wishBtn) {
            wishBtn.innerHTML = isFav ? `<i class="fa-solid fa-check"></i>` : `<i class="fa-solid fa-plus"></i>`;
            if (isFav) wishBtn.classList.add('active');

            wishBtn.onclick = (e) => {
                e.stopPropagation();
                toggleWishlist(game);
                const activeNow = wishBtn.classList.toggle('active');
                wishBtn.innerHTML = activeNow ? `<i class="fa-solid fa-check"></i>` : `<i class="fa-solid fa-plus"></i>`;
            };
        }

        const aboutBtn = clone.querySelector('.about-game-btn');
        if (aboutBtn) {
            aboutBtn.onclick = () => openConfigModal(game, 'about');
        }

        container.appendChild(clone);
    });
}

function renderPagination(totalPages) {
    const paginationContainer = document.getElementById('pagination-container');
    paginationContainer.innerHTML = '';

    if (totalPages <= 1) {
        paginationContainer.style.display = 'none';
        return;
    }
    paginationContainer.style.display = 'flex';

    const prevBtn = document.createElement('button');
    prevBtn.className = `pagination-btn ${currentPage === 1 ? 'disabled' : ''}`;
    prevBtn.innerHTML = `<i class="fa-solid fa-chevron-left"></i>`;
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => { showPage(currentPage - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    paginationContainer.appendChild(prevBtn);

    const range = [];
    for (let i = 1; i <= totalPages; i++) {
        if (i <= 3 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            if (!range.includes(i)) range.push(i);
        }
    }

    let last;
    for (let i of range) {
        if (last && i - last > 1) {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'pagination-ellipsis';
            ellipsis.textContent = '...';
            paginationContainer.appendChild(ellipsis);
        }
        
        const pageBtn = document.createElement('button');
        pageBtn.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.onclick = () => { showPage(i); window.scrollTo({ top: 0, behavior: 'smooth' }); };
        paginationContainer.appendChild(pageBtn);
        last = i;
    }

    const nextBtn = document.createElement('button');
    nextBtn.className = `pagination-btn ${currentPage === totalPages ? 'disabled' : ''}`;
    nextBtn.innerHTML = `<i class="fa-solid fa-chevron-right"></i>`;
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => { showPage(currentPage + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    paginationContainer.appendChild(nextBtn);
}

/* --- INTERACTIONS FOOTER --- */
const backToTopBtn = document.getElementById('back-to-top');
if (backToTopBtn) backToTopBtn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });

document.querySelectorAll('.footer-nav-link').forEach(link => {
    link.onclick = (e) => {
        e.preventDefault();
        const targetCategory = link.getAttribute('data-target');
        const correspondingDropdownItem = document.querySelector(`.dropdown-item[data-value="${targetCategory}"]`);
        if (correspondingDropdownItem) {
            correspondingDropdownItem.click();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };
});

document.getElementById('search-input').addEventListener('input', applyFilters);
document.addEventListener('DOMContentLoaded', fetchGames);