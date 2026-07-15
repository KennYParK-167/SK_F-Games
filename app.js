let allGames = [];          
let displayedGames = [];    
const GAMES_PER_PAGE = 16;   // Modifié à 16 jeux par page
let currentPage = 1;
let currentCategory = 'all'; 

let lastScrollY = window.scrollY;
let accumulatedScroll = 0;

// --- DOCK DE MAPPING DES FICHIERS JSON ---
const fichiersPlateformes = {
    'all': 'jeux.json',
    'GOG': 'jeux.json',
    'Repacks': 'jeux.json',
    'PS4': 'ps4.json'
};

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

dropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
});

document.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.stopPropagation();
        
        document.querySelector('.dropdown-item.active').classList.remove('active');
        item.classList.add('active');
        
        selectedValueSpan.textContent = item.textContent;
        currentCategory = item.getAttribute('data-value');
        
        fetchGames();
        dropdown.classList.remove('open');
    });
});

document.addEventListener('click', () => {
    dropdown.classList.remove('open');
});

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

/* --- FENÊTRE MODALE : LOGIQUE D'AFFICHAGE DU HARDWARE --- */
const modal = document.getElementById('config-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const tabBtns = document.querySelectorAll('.tab-btn');

closeModalBtn.addEventListener('click', () => modal.classList.remove('open'));
modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelector('.tab-btn.active').classList.remove('active');
        document.querySelector('.config-list.active').classList.remove('active');
        
        btn.classList.add('active');
        document.getElementById(`config-${btn.getAttribute('data-tab')}`).classList.add('active');
    });
});

function openConfigModal(game) {
    document.getElementById('modal-game-title').textContent = game.nom;
    
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
        const fallback = `<li><strong>Information</strong> Les caractéristiques matérielles ne sont pas requises ou renseignées pour ce jeu.</li>`;
        minContainer.innerHTML = fallback;
        recContainer.innerHTML = fallback;
    }
    
    modal.classList.add('open');
}

/* --- NAVBAR ACCUMULATIVE (SMART SCROLL HIDE) --- */
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
            searchBox.classList.open = false;
            searchBox.classList.remove('open');
        }
        accumulatedScroll = 0;
    } else if (accumulatedScroll <= -10 || currentScrollY <= 0) {
        navbar.classList.remove('hidden');
        accumulatedScroll = 0;
    }
    lastScrollY = currentScrollY;
});

/* --- FETCH DYNAMIQUE DU JSON PAR PLATEFORME --- */
async function fetchGames() {
    if (currentCategory === 'all') {
        try {
            const [responsePc, responsePs4] = await Promise.all([
                fetch('jeux.json'),
                fetch('ps4.json')
            ]);
            
            if (!responsePc.ok || !responsePs4.ok) throw new Error("Erreur réseau détectée lors du chargement des catalogues");
            
            const jeuxPc = await responsePc.json();
            const jeuxPs4 = await responsePs4.json();
            
            allGames = [...jeuxPc, ...jeuxPs4];
            applyFilters();
        } catch (error) {
            console.error("Erreur JSON Global :", error);
            document.getElementById('games-container').innerHTML = `
                <div class="alert-container">
                    <i class="fa-solid fa-circle-info alert-icon"></i>
                    <p class="alert-text">Impossible de charger la base de données des jeux.</p>
                </div>
            `;
            document.getElementById('pagination-container').style.display = 'none';
        }
        return;
    }

    const fichierCible = fichiersPlateformes[currentCategory] || 'jeux.json';

    try {
        const response = await fetch(fichierCible);
        if (!response.ok) throw new Error("Erreur réseau détectée lors du chargement");
        allGames = await response.json();
        applyFilters(); 
    } catch (error) {
        console.error("Erreur JSON :", error);
        document.getElementById('games-container').innerHTML = `
            <div class="alert-container">
                <i class="fa-solid fa-circle-info alert-icon"></i>
                <p class="alert-text">Impossible de charger la base de données des jeux.</p>
            </div>
        `;
        document.getElementById('pagination-container').style.display = 'none';
    }
}

/* ACCÈS ET CALCUL DE LA SÉLECTION FILTRÉE */
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

    if (currentCategory === 'all' && searchString === '') {
        source = shuffleByDay([...source]);
    }

    return source;
}

/* SYSTEME DE RENDER ET FILTRAGE CENTRALISÉ */
function applyFilters() {
    currentPage = 1;
    showPage(currentPage);
}

// Calcule la tranche d'index à afficher et reconstruit la pagination
function showPage(page) {
    const filteredSource = getFilteredSource();
    const totalPages = Math.ceil(filteredSource.length / GAMES_PER_PAGE);
    
    // Protection des bornes de pages
    if (page < 1) page = 1;
    if (page > totalPages && totalPages > 0) page = totalPages;
    currentPage = page;

    const startIndex = (currentPage - 1) * GAMES_PER_PAGE;
    const endIndex = startIndex + GAMES_PER_PAGE;
    displayedGames = filteredSource.slice(startIndex, endIndex);

    renderGames(displayedGames);
    renderPagination(totalPages);
    
    // Petit effet fluide pour remonter en haut du site lors d'un changement de page
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderGames(gamesList) {
    const container = document.getElementById('games-container');
    container.innerHTML = ''; 

    if (gamesList.length === 0) {
        container.innerHTML = `
            <div class="alert-container">
                <i class="fa-solid fa-circle-info alert-icon"></i>
                <p class="alert-text">Aucun jeu ne correspond à votre recherche actuelle.</p>
            </div>
        `;
        return;
    }
    appendGames(gamesList);
}

function appendGames(gamesList) {
    const container = document.getElementById('games-container');
    const template = document.getElementById('game-card-template');

    gamesList.forEach(game => {
        const clone = template.content.cloneNode(true);
        clone.querySelector('.game-img').src = game.image;
        clone.querySelector('.game-img').alt = game.nom;
        clone.querySelector('.game-title').textContent = game.nom;
        clone.querySelector('.game-category').textContent = game.categorie;
        clone.querySelector('.download-btn').href = game.lien;
        
        clone.querySelector('.config-specs-btn').addEventListener('click', () => {
            openConfigModal(game);
        });

        container.appendChild(clone);
    });
}

/* RENDER DE L'ÉLÉMENT DE PAGINATION CONTROLLER */
function renderPagination(totalPages) {
    const paginationContainer = document.getElementById('pagination-container');
    paginationContainer.innerHTML = '';

    // Si on a 1 seule page ou aucune, on cache complètement le conteneur de pagination
    if (totalPages <= 1) {
        paginationContainer.style.display = 'none';
        return;
    }
    paginationContainer.style.display = 'flex';

    // Bouton Précédent (chevron)
    const prevBtn = document.createElement('button');
    prevBtn.className = `pagination-btn ${currentPage === 1 ? 'disabled' : ''}`;
    prevBtn.innerHTML = `<i class="fa-solid fa-chevron-left"></i>`;
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener('click', () => showPage(currentPage - 1));
    paginationContainer.appendChild(prevBtn);

    // Définition des pages à afficher pour ne pas surcharger les mobiles (limite visuelle)
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

    // Indicateur de première page si on est loin
    if (startPage > 1) {
        const firstPageBtn = document.createElement('button');
        firstPageBtn.className = 'pagination-btn';
        firstPageBtn.textContent = '1';
        firstPageBtn.addEventListener('click', () => showPage(1));
        paginationContainer.appendChild(firstPageBtn);

        if (startPage > 2) {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'pagination-ellipsis';
            ellipsis.textContent = '...';
            paginationContainer.appendChild(ellipsis);
        }
    }

    // Génération des boutons numériques individuels
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.addEventListener('click', () => showPage(i));
        paginationContainer.appendChild(pageBtn);
    }

    // Indicateur de dernière page si on est loin
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'pagination-ellipsis';
            ellipsis.textContent = '...';
            paginationContainer.appendChild(ellipsis);
        }
        
        const lastPageBtn = document.createElement('button');
        lastPageBtn.className = 'pagination-btn';
        lastPageBtn.textContent = totalPages;
        lastPageBtn.addEventListener('click', () => showPage(totalPages));
        paginationContainer.appendChild(lastPageBtn);
    }

    // Bouton Suivant (chevron)
    const nextBtn = document.createElement('button');
    nextBtn.className = `pagination-btn ${currentPage === totalPages ? 'disabled' : ''}`;
    nextBtn.innerHTML = `<i class="fa-solid fa-chevron-right"></i>`;
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener('click', () => showPage(currentPage + 1));
    paginationContainer.appendChild(nextBtn);
}

document.getElementById('search-input').addEventListener('input', applyFilters);
document.addEventListener('DOMContentLoaded', fetchGames);