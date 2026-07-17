let allGames = [];          
let displayedGames = [];    
const GAMES_PER_PAGE = 8;   
let currentPage = 1;
let currentCategory = 'all'; 

let lastScrollY = window.scrollY;
let accumulatedScroll = 0;

// --- DOCK DE MAPPING DES FICHIERS JSON ---
// Lie les catégories sélectionnées aux bons fichiers JSON
const fichiersPlateformes = {
    'all': 'jeux.json',
    'GOG': 'jeux.json',
    'Repacks': 'jeux.json',
    'PS4': 'ps4.json'
};

/* --- SEED COMPATIBLE : ALGORITHME DE MÉLANGE QUOTIEN --- */
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
        
        // Au lieu d'appliquer directement les filtres, on va charger le fichier correspondant si nécessaire
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
            searchBox.classList.remove('open');
        }
        accumulatedScroll = 0;
    } else if (accumulatedScroll <= -10 || currentScrollY <= 0) {
        navbar.classList.remove('hidden');
        accumulatedScroll = 0;
    }
    lastScrollY = currentScrollY;
});

/* DETECTEUR DE SCROLL INFINI */
window.addEventListener('scroll', () => {
    if ((window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 100) {
        loadMoreGames();
    }
});

/* FETCH DYNAMIQUE DU JSON PAR PLATEFORME */
async function fetchGames() {
    // Si l'onglet en cours est "all", on combine jeux.json et ps4.json simultanément
    if (currentCategory === 'all') {
        try {
            const [responsePc, responsePs4] = await Promise.all([
                fetch('jeux.json'),
                fetch('ps4.json')
            ]);
            
            if (!responsePc.ok || !responsePs4.ok) throw new Error("Erreur réseau détectée lors du chargement des catalogues");
            
            const jeuxPc = await responsePc.json();
            const jeuxPs4 = await responsePs4.json();
            
            // Fusion complète des deux bases de données
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
        }
        return;
    }

    // Comportement initial inchangé pour le filtrage par fichier unique (ex: onglet PS4 ciblé directement)
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
    }
}

/* ACCÈS ET CALCUL DE LA SÉLECTION FILTRÉE */
function getFilteredSource() {
    const searchString = document.getElementById('search-input').value.toLowerCase().trim();

    let source = allGames.filter(game => {
        const matchesSearch = game.nom.toLowerCase().includes(searchString);
        
        // Gestion des sous-catégories PC si le fichier jeux.json contient du GOG ou du Repacks
        let matchesCategory = true;
        if (currentCategory === 'GOG' || currentCategory === 'Repacks') {
            matchesCategory = game.categorie.toLowerCase() === currentCategory.toLowerCase();
        } else if (currentCategory === 'ps4') {
            // Pour la PS4, on fait confiance au fichier ps4.json autonome
            matchesCategory = true;
        }

        return matchesSearch && matchesCategory;
    });

    // Tri dynamique aléatoire quotidien uniquement sur l'onglet global "all" et sans recherche textuelle active
    if (currentCategory === 'all' && searchString === '') {
        source = shuffleByDay([...source]);
    }

    return source;
}

/* SYSTEME DE RENDER ET FILTRAGE CENTRALISÉ */
function applyFilters() {
    const filteredSource = getFilteredSource();
    currentPage = 1;
    displayedGames = filteredSource.slice(0, GAMES_PER_PAGE);
    renderGames(displayedGames);
}

function loadMoreGames() {
    const filteredSource = getFilteredSource();

    if (displayedGames.length < filteredSource.length) {
        const nextStartIndex = currentPage * GAMES_PER_PAGE;
        const nextEndIndex = nextStartIndex + GAMES_PER_PAGE;
        
        const nextBatch = filteredSource.slice(nextStartIndex, nextEndIndex);
        displayedGames = displayedGames.concat(nextBatch);
        appendGames(nextBatch);
        
        currentPage++;
    }
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

document.getElementById('search-input').addEventListener('input', applyFilters);
document.addEventListener('DOMContentLoaded', fetchGames);