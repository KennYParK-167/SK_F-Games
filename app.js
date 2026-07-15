// --- CONFIGURATION SUPABASE ---
// REMPLACE CES DEUX LIGNES PAR TES PROPRES CLÉS SUPABASE (que tu as copiées) !
const SUPABASE_URL = "https://yqmjjhefhsasnaevbnke.supabase.co"; //
const SUPABASE_ANON_KEY = "sb_publishable_xwTUSF9OHZ2LK3vVoVFlZw_bXz74mUq"; 

// Initialisation du client Supabase
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let allGames = [];          
let displayedGames = [];    
const GAMES_PER_PAGE = 16; 
let currentPage = 1;
let currentCategory = 'all'; 

let userSession = null;
let userWishlist = []; // Stocke les IDs ou noms des jeux mis en favoris

let lastScrollY = window.scrollY;
let accumulatedScroll = 0;

const fichiersPlateformes = {
    'all': 'jeux.json',
    'GOG': 'jeux.json',
    'Repacks': 'jeux.json',
    'PS4': 'ps4.json'
};

/* --- ALGORITHME DE MÉLANGE QUOTIDIEN --- */
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

/* --- LOGIQUE DU BURGER ET NAVIGATION RESPONSIVE --- */
const burgerBtn = document.getElementById('burger-btn');
const navMenu = document.getElementById('nav-menu');

burgerBtn.addEventListener('click', () => {
    burgerBtn.classList.toggle('open');
    navMenu.classList.toggle('open');
});

// Ferme le menu burger si on clique sur un lien ou en dehors
document.addEventListener('click', (e) => {
    if (!burgerBtn.contains(e.target) && !navMenu.contains(e.target)) {
        burgerBtn.classList.remove('open');
        navMenu.classList.remove('open');
    }
});

/* --- DROPDOWN CATÉGORIES --- */
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
        
        // Ferme le burger après sélection
        burgerBtn.classList.remove('open');
        navMenu.classList.remove('open');
    });
});

document.addEventListener('click', () => {
    dropdown.classList.remove('open');
});

/* --- LOUPE RESPONSIVE MOBILE --- */
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

/* --- MODALE : HARDWARE SPECS --- */
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
        const fallback = `<li><strong>Information</strong> Caractéristiques non requises ou non spécifiées.</li>`;
        minContainer.innerHTML = fallback;
        recContainer.innerHTML = fallback;
    }
    modal.classList.add('open');
}

/* --- AUTHENTIFICATION : LOGIQUE SUPABASE --- */
const authModal = document.getElementById('auth-modal');
const authBtn = document.getElementById('auth-btn');
const authBtnText = document.getElementById('auth-btn-text');
const closeAuthBtn = document.getElementById('close-auth-btn');
const tabLoginBtn = document.getElementById('tab-login-btn');
const tabRegisterBtn = document.getElementById('tab-register-btn');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authMessage = document.getElementById('auth-message');
const wishlistToggle = document.getElementById('wishlist-toggle');

// Ouvre / Ferme la modale
authBtn.addEventListener('click', async () => {
    if (userSession) {
        // Déconnexion si déjà connecté
        const { error } = await supabase.auth.signOut();
        if (!error) {
            updateUserUI(null);
            showAuthMessage("Déconnecté avec succès", "success");
        }
    } else {
        authModal.classList.add('open');
    }
});

closeAuthBtn.addEventListener('click', () => authModal.classList.remove('open'));
authModal.addEventListener('click', (e) => { if (e.target === authModal) authModal.classList.remove('open'); });

// Onglets Inscription / Connexion
tabLoginBtn.addEventListener('click', () => {
    tabLoginBtn.classList.add('active');
    tabRegisterBtn.classList.remove('active');
    loginForm.classList.add('active');
    registerForm.classList.remove('active');
});

tabRegisterBtn.addEventListener('click', () => {
    tabRegisterBtn.classList.add('active');
    tabLoginBtn.classList.remove('active');
    registerForm.classList.add('active');
    loginForm.classList.remove('active');
});

// Soumission : Inscription
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showAuthMessage("Création du compte...", "");
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
        showAuthMessage(error.message, "error");
    } else {
        showAuthMessage("Inscription réussie ! Vérifie ton email pour valider le compte.", "success");
        registerForm.reset();
    }
});

// Soumission : Connexion
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showAuthMessage("Connexion...", "");
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        showAuthMessage(error.message, "error");
    } else {
        showAuthMessage("Connexion réussie !", "success");
        updateUserUI(data.user);
        setTimeout(() => {
            authModal.classList.remove('open');
            authMessage.textContent = "";
        }, 1500);
        loginForm.reset();
    }
});

function showAuthMessage(text, type) {
    authMessage.textContent = text;
    authMessage.className = `auth-message ${type}`;
}

// Mise à jour de l'interface utilisateur (Connexion/Déconnexion)
function updateUserUI(user) {
    userSession = user;
    if (user) {
        authBtnText.textContent = "Déconnexion";
        wishlistToggle.classList.remove('hidden');
        fetchUserWishlist();
    } else {
        authBtnText.textContent = "Se connecter";
        wishlistToggle.classList.add('hidden');
        userWishlist = [];
        renderGames(displayedGames); // Rafraîchit les icônes de favoris
    }
}

// Récupère la Wishlist de l'utilisateur
async function fetchUserWishlist() {
    if (!supabase || !userSession) return;
    
    const { data, error } = await supabase
        .from('wishlists')
        .select('game_nom')
        .eq('user_id', userSession.id);

    if (!error && data) {
        userWishlist = data.map(item => item.game_nom);
        renderGames(displayedGames); // Met à jour l'état visuel des coeurs
    }
}

// Gère le clic sur l'icône de Wishlist
async function toggleWishlist(gameNom, buttonElement) {
    if (!supabase) return;
    if (!userSession) {
        // Redirige vers la connexion si pas connecté
        authModal.classList.add('open');
        showAuthMessage("Connecte-toi pour ajouter à ta wishlist !", "error");
        return;
    }

    const isFav = userWishlist.includes(gameNom);

    if (isFav) {
        // Retirer de la wishlist
        const { error } = await supabase
            .from('wishlists')
            .delete()
            .eq('user_id', userSession.id)
            .eq('game_nom', gameNom);

        if (!error) {
            userWishlist = userWishlist.filter(name => name !== gameNom);
            buttonElement.classList.remove('active');
            buttonElement.querySelector('i').className = 'fa-regular fa-heart';
        }
    } else {
        // Ajouter à la wishlist
        const { error } = await supabase
            .from('wishlists')
            .insert([{ user_id: userSession.id, game_nom: gameNom }]);

        if (!error) {
            userWishlist.push(gameNom);
            buttonElement.classList.add('active');
            buttonElement.querySelector('i').className = 'fa-solid fa-heart';
        }
    }
}

// Gère le filtrage de la liste de favoris (clic sur "Mon Profil")
let showingFavoritesOnly = false;
wishlistToggle.addEventListener('click', () => {
    showingFavoritesOnly = !showingFavoritesOnly;
    wishlistToggle.classList.toggle('active', showingFavoritesOnly);
    
    if (showingFavoritesOnly) {
        wishlistToggle.innerHTML = `<i class="fa-solid fa-gamepad"></i> Tous les jeux`;
    } else {
        wishlistToggle.innerHTML = `<i class="fa-solid fa-heart"></i> Mon Profil`;
    }
    applyFilters();
});

/* --- NAVBAR ACCUMULATIVE --- */
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

/* FETCH DYNAMIQUE DU JSON PAR PLATEFORME */
async function fetchGames() {
    if (currentCategory === 'all') {
        try {
            const [responsePc, responsePs4] = await Promise.all([
                fetch('jeux.json'),
                fetch('ps4.json')
            ]);
            
            if (!responsePc.ok || !responsePs4.ok) throw new Error("Erreur réseau détectée");
            
            const jeuxPc = await responsePc.json();
            const jeuxPs4 = await responsePs4.json();
            
            allGames = [...jeuxPc, ...jeuxPs4];
            applyFilters();
        } catch (error) {
            console.error("Erreur JSON Global :", error);
            document.getElementById('games-container').innerHTML = `
                <div class="alert-container">
                    <i class="fa-solid fa-circle-info alert-icon"></i>
                    <p class="alert-text">Impossible de charger le catalogue de jeux.</p>
                </div>
            `;
            document.getElementById('pagination-container').style.display = 'none';
        }
        return;
    }

    const fichierCible = fichiersPlateformes[currentCategory] || 'jeux.json';

    try {
        const response = await fetch(fichierCible);
        if (!response.ok) throw new Error("Erreur de chargement");
        allGames = await response.json();
        applyFilters(); 
    } catch (error) {
        console.error("Erreur JSON :", error);
        document.getElementById('games-container').innerHTML = `
            <div class="alert-container">
                <i class="fa-solid fa-circle-info alert-icon"></i>
                <p class="alert-text">Impossible de charger la base de données.</p>
            </div>
        `;
        document.getElementById('pagination-container').style.display = 'none';
    }
}

/* CALCUL DE LA SÉLECTION FILTRÉE */
function getFilteredSource() {
    const searchString = document.getElementById('search-input').value.toLowerCase().trim();

    let source = allGames.filter(game => {
        const matchesSearch = game.nom.toLowerCase().includes(searchString);
        
        let matchesCategory = true;
        if (currentCategory === 'GOG' || currentCategory === 'Repacks') {
            matchesCategory = game.categorie.toLowerCase() === currentCategory.toLowerCase();
        }

        return matchesSearch && matchesCategory;
    });

    if (currentCategory === 'all' && searchString === '') {
        source = shuffleByDay([...source]);
    }

    // Filtrer par favoris uniquement si l'utilisateur a cliqué sur "Mon Profil"
    if (showingFavoritesOnly && userSession) {
        source = source.filter(game => userWishlist.includes(game.nom));
    }

    return source;
}

function applyFilters() {
    currentPage = 1;
    showPage(currentPage);
}

function showPage(page) {
    const filteredSource = getFilteredSource();
    const totalPages = Math.ceil(filteredSource.length / GAMES_PER_PAGE);
    
    if (page < 1) page = 1;
    if (page > totalPages && totalPages > 0) page = totalPages;
    currentPage = page;

    const startIndex = (currentPage - 1) * GAMES_PER_PAGE;
    const endIndex = startIndex + GAMES_PER_PAGE;
    displayedGames = filteredSource.slice(startIndex, endIndex);

    renderGames(displayedGames);
    renderPagination(totalPages);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderGames(gamesList) {
    const container = document.getElementById('games-container');
    container.innerHTML = ''; 

    if (gamesList.length === 0) {
        container.innerHTML = `
            <div class="alert-container">
                <i class="fa-solid fa-circle-info alert-icon"></i>
                <p class="alert-text">Aucun jeu à afficher pour le moment.</p>
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
        
        // Gestion de l'état de l'icône wishlist
        const wishBtn = clone.querySelector('.wishlist-btn');
        const isFav = userWishlist.includes(game.nom);
        
        if (isFav) {
            wishBtn.classList.add('active');
            wishBtn.querySelector('i').className = 'fa-solid fa-heart';
        }

        wishBtn.addEventListener('click', () => {
            toggleWishlist(game.nom, wishBtn);
        });

        clone.querySelector('.config-specs-btn').addEventListener('click', () => {
            openConfigModal(game);
        });

        container.appendChild(clone);
    });
}

/* RENDU DES BOUTONS DE PAGINATION */
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
    prevBtn.addEventListener('click', () => showPage(currentPage - 1));
    paginationContainer.appendChild(prevBtn);

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

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

    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.addEventListener('click', () => showPage(i));
        paginationContainer.appendChild(pageBtn);
    }

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

    const nextBtn = document.createElement('button');
    nextBtn.className = `pagination-btn ${currentPage === totalPages ? 'disabled' : ''}`;
    nextBtn.innerHTML = `<i class="fa-solid fa-chevron-right"></i>`;
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener('click', () => showPage(currentPage + 1));
    paginationContainer.appendChild(nextBtn);
}

// Initialisation globale et vérification de la session active
document.getElementById('search-input').addEventListener('input', applyFilters);

document.addEventListener('DOMContentLoaded', async () => {
    await fetchGames();
    
    if (supabase) {
        // Gère automatiquement les sessions d'authentification (jetons)
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            updateUserUI(session.user);
        }

        // Écoute les changements d'état (Connexion, Déconnexion)
        supabase.auth.onAuthStateChange((_event, session) => {
            updateUserUI(session ? session.user : null);
        });
    }
});