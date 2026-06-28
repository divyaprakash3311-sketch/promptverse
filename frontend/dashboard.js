// Backend connection details
const API_BASE = "http://127.0.0.1:5000";

// Global client state
let state = {
    userSession: JSON.parse(localStorage.getItem('promptverse_session')) || null,
    prompts: [],
    activeCategory: 'all',
    searchQuery: '',
    currentPromptId: null   // tracks which prompt's details modal is open
};

// Document Lifecycle Init
document.addEventListener('DOMContentLoaded', () => {
    updateAuthUI();
    fetchPrompts();
    setupSearch();
});

// Setup Real-time Search listener
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            state.searchQuery = e.target.value.toLowerCase().trim();
            renderPrompts();
        });
    }
}

// Fetch public prompts from Python backend
async function fetchPrompts() {
    showLoader(true);
    showError(false);
    showEmptyState(false);
    
    try {
        const response = await fetch(`${API_BASE}/api/prompts`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        state.prompts = data.prompts || [];
        renderPrompts();
    } catch (err) {
        console.error("API Connection Error:", err);
        showError(true);
        showLoader(false);
    }
}

// Update authentication elements in header & sidebar
function updateAuthUI() {
    const authHeader = document.getElementById('authHeaderSection');
    const createBtn = document.getElementById('sidebarCreateBtn');
    const createTooltip = document.getElementById('createBtnTooltip');
    
    if (!authHeader) return;

    if (state.userSession) {
        // Authenticated State
        authHeader.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/5 rounded-xl">
                    <div class="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs uppercase">
                        ${state.userSession.username.substring(0, 2)}
                    </div>
                    <span class="text-sm font-semibold text-white/90">${state.userSession.username}</span>
                </div>
                <button onclick="handleLogout()" class="px-4 py-2 rounded-xl text-xs font-bold border border-red-500/20 hover:bg-red-500/10 text-red-400 transition-all duration-300">
                    Sign Out
                </button>
            </div>
        `;
        if (createBtn) {
            createBtn.removeAttribute('disabled');
            createBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
        if (createTooltip) {
            createTooltip.classList.add('hidden');
        }
    } else {
        // Unauthenticated State
        authHeader.innerHTML = `
            <button onclick="openModal('loginModal')" class="px-5 py-2 rounded-xl text-sm font-semibold border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white transition-all duration-300">
                Sign In
            </button>
            <button onclick="openModal('registerModal')" class="px-5 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-glowIndigo to-glowPurple hover:from-indigo-600 hover:to-purple-600 text-white shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/25 transition-all duration-300">
                Register
            </button>
        `;
        if (createBtn) {
            createBtn.setAttribute('disabled', 'true');
            createBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
        if (createTooltip) {
            createTooltip.classList.remove('hidden');
        }
    }
}

// Category Selection handler
function selectCategory(category) {
    state.activeCategory = category;
    
    // Update active UI tabs
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const selectedBtn = document.getElementById(`cat-${category}`);
    if (selectedBtn) {
        selectedBtn.classList.add('active');
    }
    
    renderPrompts();
}

// Render dynamic grid of prompt cards
function renderPrompts() {
    const grid = document.getElementById('promptsGrid');
    if (!grid) return;
    
    // Filter logic
    let filtered = state.prompts;
    
    // 1. Category Filter
    if (state.activeCategory !== 'all') {
        filtered = filtered.filter(p => p.category === state.activeCategory);
    }
    
    // 2. Search query filter
    if (state.searchQuery) {
        filtered = filtered.filter(p => 
            p.title.toLowerCase().includes(state.searchQuery) ||
            p.content.toLowerCase().includes(state.searchQuery) ||
            (p.category && p.category.toLowerCase().includes(state.searchQuery)) ||
            (p.author_username && p.author_username.toLowerCase().includes(state.searchQuery)) ||
            (p.difficulty && p.difficulty.toLowerCase().includes(state.searchQuery)) ||
            (p.tags && p.tags.toLowerCase().includes(state.searchQuery))
        );
    }
    
    // Update Items Count display
    const countDisplay = document.getElementById('itemsCountDisplay');
    if (countDisplay) {
        countDisplay.textContent = `Showing ${filtered.length} prompt${filtered.length === 1 ? '' : 's'}`;
    }
    
    showLoader(false);
    
    if (filtered.length === 0) {
        grid.classList.add('hidden');
        showEmptyState(true);
        return;
    }
    
    showEmptyState(false);
    grid.classList.remove('hidden');
    grid.innerHTML = '';
    
    filtered.forEach(prompt => {
        const card = document.createElement('div');
        card.className = "glass-card p-6 rounded-2xl flex flex-col justify-between cursor-pointer hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-300";
        card.onclick = (e) => {
            // Do not open details modal if copy button or icon inside it was clicked
            if (e.target.closest('button')) return;
            openPromptDetails(prompt);
        };
        
        // Define visual pill based on category
        let categoryColor = "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
        if (prompt.category === 'Coding') categoryColor = "bg-blue-500/10 text-blue-400 border-blue-500/20";
        else if (prompt.category === 'Creative') categoryColor = "bg-purple-500/10 text-purple-400 border-purple-500/20";
        else if (prompt.category === 'Marketing') categoryColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
        else if (prompt.category === 'Academic') categoryColor = "bg-amber-500/10 text-amber-400 border-amber-500/20";
        
        // Define visual pill based on difficulty
        let difficultyColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
        if (prompt.difficulty === 'Intermediate') difficultyColor = "bg-amber-500/10 text-amber-400 border-amber-500/20";
        else if (prompt.difficulty === 'Advanced') difficultyColor = "bg-red-500/10 text-red-400 border-red-500/20";
        
        // Define tags bubbles HTML
        let tagsHtml = '';
        if (prompt.tags) {
            const tagsList = prompt.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
            if (tagsList.length > 0) {
                tagsHtml = `<div class="flex flex-wrap gap-1.5 mt-2 mb-3">` + 
                    tagsList.map(tag => `<span class="px-2 py-0.5 bg-white/5 border border-white/5 rounded text-[10px] text-white/50 font-medium">#${tag}</span>`).join('') +
                    `</div>`;
            }
        }
        
        const rawDate = new Date(prompt.created_at);
        const formattedDate = rawDate.toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'});

        card.innerHTML = `
            <div>
                <!-- Category, Difficulty, and Title -->
                <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold border ${categoryColor}">
                            ${prompt.category || 'General'}
                        </span>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold border ${difficultyColor}">
                            ${prompt.difficulty || 'Beginner'}
                        </span>
                    </div>
                    <span class="text-[10px] text-white/30 font-semibold uppercase tracking-wider">
                        ${prompt.is_public ? 'Public' : 'Private'}
                    </span>
                </div>
                <h3 class="font-display font-bold text-lg text-white mb-1 line-clamp-1">${escapeHTML(prompt.title)}</h3>
                ${tagsHtml}
                <!-- Code Prompt Box -->
                <div class="code-container p-4 mt-2 mb-4 max-h-40 overflow-y-auto custom-scrollbar">
                    <pre class="text-xs text-indigo-200/90 whitespace-pre-wrap font-mono">${escapeHTML(prompt.content)}</pre>
                </div>
            </div>
            
            <!-- Card Footer -->
            <div class="flex items-center justify-between pt-3 border-t border-white/5 mt-auto">
                <div class="flex flex-col">
                    <span class="text-xs text-white/50">By <strong class="text-white/80">${escapeHTML(prompt.author_username || 'Anonymous')}</strong></span>
                    <span class="text-[10px] text-white/30 mt-0.5">${formattedDate}</span>
                </div>
                <button onclick="copyToClipboard('${escapeJSString(prompt.content)}', '${escapeJSString(prompt.title)}')" 
                    class="p-2 rounded-xl bg-white/5 border border-white/5 text-white/60 hover:text-white hover:bg-indigo-500/20 hover:border-indigo-500/30 transition-all duration-300"
                    title="Copy prompt text">
                    <i class="fa-solid fa-copy text-sm"></i>
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

// User Registration form submit handler
async function handleRegister(e) {
    e.preventDefault();
    const errorDiv = document.getElementById('registerError');
    errorDiv.classList.add('hidden');
    
    const username = document.getElementById('regUsername').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    
    try {
        const response = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || "Registration failed");
        }
        
        showToast("Registration successful! Please sign in.", "success");
        closeModal('registerModal');
        openModal('loginModal');
        document.getElementById('registerForm').reset();
    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.classList.remove('hidden');
    }
}

// User Login form submit handler
async function handleLogin(e) {
    e.preventDefault();
    const errorDiv = document.getElementById('loginError');
    errorDiv.classList.add('hidden');
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || "Invalid credentials");
        }
        
        state.userSession = data.session;
        localStorage.setItem('promptverse_session', JSON.stringify(data.session));
        
        showToast(`Welcome back, ${data.session.username}!`, "success");
        closeModal('loginModal');
        updateAuthUI();
        document.getElementById('loginForm').reset();
    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.classList.remove('hidden');
    }
}

// User Logout action
function handleLogout() {
    state.userSession = null;
    localStorage.removeItem('promptverse_session');
    updateAuthUI();
    showToast("Signed out successfully", "info");
}

// Create Prompt form submit handler
async function handleCreatePrompt(e) {
    e.preventDefault();
    const errorDiv = document.getElementById('createPromptError');
    errorDiv.classList.add('hidden');
    
    const title = document.getElementById('promptTitle').value.trim();
    const category = document.getElementById('promptCategory').value;
    const difficulty = document.getElementById('promptDifficulty').value;
    const tags = document.getElementById('promptTags').value.trim();
    const content = document.getElementById('promptContent').value.trim();
    const isPublic = document.getElementById('promptIsPublic').checked;
    
    if (!state.userSession) {
        showToast("Session expired. Please log in again.", "error");
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/prompts`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.userSession.session_id}`
            },
            body: JSON.stringify({ title, category, difficulty, tags, content, is_public: isPublic })
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || "Failed to create prompt");
        }
        
        showToast("Prompt published successfully!", "success");
        closeModal('createPromptModal');
        document.getElementById('createPromptForm').reset();
        
        // Refresh catalog feed
        fetchPrompts();
    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.classList.remove('hidden');
    }
}

// Clipboard copy operation
function copyToClipboard(text, title) {
    navigator.clipboard.writeText(text).then(() => {
        showToast(`Copied instructions for: "${title}"`, "success");
    }).catch(err => {
        console.error("Failed to copy text: ", err);
        showToast("Failed to copy code to clipboard", "error");
    });
}

// Toast alerts engine
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = "toast-alert flex items-center gap-3 px-5 py-3 rounded-2xl text-white text-sm max-w-sm pointer-events-auto shadow-xl";
    
    let icon = '<i class="fa-solid fa-circle-info text-indigo-400"></i>';
    if (type === 'success') {
        icon = '<i class="fa-solid fa-circle-check text-emerald-400"></i>';
    } else if (type === 'error') {
        icon = '<i class="fa-solid fa-circle-xmark text-red-400"></i>';
    }
    
    toast.innerHTML = `
        ${icon}
        <span class="font-medium">${escapeHTML(message)}</span>
    `;
    
    container.appendChild(toast);
    
    // Automatically dismiss toast after 3.5 seconds
    setTimeout(() => {
        toast.classList.add('hide');
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 3500);
}

// Reset filter/search to default catalog view
function resetFeed() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    state.searchQuery = '';
    selectCategory('all');
}

// Modal Toggle Helpers
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('flex');
        modal.classList.add('hidden');
        
        // Reset errors when closing
        const regError = document.getElementById('registerError');
        const loginError = document.getElementById('loginError');
        const createError = document.getElementById('createPromptError');
        if (regError) regError.classList.add('hidden');
        if (loginError) loginError.classList.add('hidden');
        if (createError) createError.classList.add('hidden');
    }
}

function switchModal(closeId, openId) {
    closeModal(closeId);
    openModal(openId);
}

function openCreatePromptModal() {
    if (!state.userSession) {
        showToast("You must be logged in to create a prompt.", "error");
        return;
    }
    openModal('createPromptModal');
}

// UI State Visibility Helpers
function showLoader(show) {
    const loader = document.getElementById('loader');
    if (loader) {
        if (show) loader.classList.remove('hidden');
        else loader.classList.add('hidden');
    }
}

function showError(show) {
    const err = document.getElementById('errorState');
    if (err) {
        if (show) err.classList.remove('hidden');
        else err.classList.add('hidden');
    }
}

function showEmptyState(show) {
    const empty = document.getElementById('emptyState');
    if (empty) {
        if (show) empty.classList.remove('hidden');
        else empty.classList.add('hidden');
    }
}

// Escape utilities for DOM injection safety
function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeJSString(str) {
    if (!str) return '';
    return str
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');
}

// Immersive Glassmorphic Details Modal Handler
function openPromptDetails(prompt) {
    const modal = document.getElementById('promptDetailsModal');
    if (!modal) return;
    
    // Set text elements
    document.getElementById('detailsTitle').textContent = prompt.title;
    document.getElementById('detailsContent').textContent = prompt.content;
    document.getElementById('detailsAuthor').textContent = prompt.author_username || 'Anonymous';
    
    const rawDate = new Date(prompt.created_at);
    const formattedDate = rawDate.toLocaleDateString(undefined, {
        month: 'long', 
        day: 'numeric', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit'
    });
    document.getElementById('detailsDate').textContent = formattedDate;
    
    // Category pill styling
    const catEl = document.getElementById('detailsCategory');
    catEl.textContent = prompt.category || 'General';
    catEl.className = "px-2.5 py-0.5 rounded-full text-xs font-semibold border";
    if (prompt.category === 'Coding') {
        catEl.classList.add("bg-blue-500/10", "text-blue-400", "border-blue-500/20");
    } else if (prompt.category === 'Creative') {
        catEl.classList.add("bg-purple-500/10", "text-purple-400", "border-purple-500/20");
    } else if (prompt.category === 'Marketing') {
        catEl.classList.add("bg-emerald-500/10", "text-emerald-400", "border-emerald-500/20");
    } else if (prompt.category === 'Academic') {
        catEl.classList.add("bg-amber-500/10", "text-amber-400", "border-amber-500/20");
    } else {
        catEl.classList.add("bg-indigo-500/10", "text-indigo-400", "border-indigo-500/20");
    }
    
    // Difficulty pill styling
    const diffEl = document.getElementById('detailsDifficulty');
    const difficulty = prompt.difficulty || 'Beginner';
    diffEl.textContent = difficulty;
    diffEl.className = "px-2.5 py-0.5 rounded-full text-xs font-semibold border";
    if (difficulty === 'Advanced') {
        diffEl.classList.add("bg-red-500/10", "text-red-400", "border-red-500/20");
    } else if (difficulty === 'Intermediate') {
        diffEl.classList.add("bg-amber-500/10", "text-amber-400", "border-amber-500/20");
    } else {
        diffEl.classList.add("bg-emerald-500/10", "text-emerald-400", "border-emerald-500/20"); // Beginner
    }
    
    // Visibility indicator
    document.getElementById('detailsVisibility').textContent = prompt.is_public ? 'Public' : 'Private';
    
    // Custom Tags list
    const tagsContainer = document.getElementById('detailsTagsContainer');
    tagsContainer.innerHTML = '';
    if (prompt.tags) {
        const tagsList = prompt.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
        if (tagsList.length > 0) {
            tagsList.forEach(tag => {
                const tagSpan = document.createElement('span');
                tagSpan.className = "px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-white/70 font-medium hover:text-white hover:bg-white/10 transition-colors duration-200";
                tagSpan.textContent = `#${tag}`;
                tagsContainer.appendChild(tagSpan);
            });
        } else {
            tagsContainer.innerHTML = '<span class="text-xs text-white/30 italic">No tags</span>';
        }
    } else {
        tagsContainer.innerHTML = '<span class="text-xs text-white/30 italic">No tags</span>';
    }
    
    // Setup copy button interaction
    const copyBtn = document.getElementById('detailsCopyBtn');
    copyBtn.onclick = () => {
        copyToClipboard(prompt.content, prompt.title);
    };

    // Track which prompt is open and load its comments
    state.currentPromptId = prompt.id;
    fetchComments(prompt.id);

    // Show/hide comment composer depending on auth state
    const authGate = document.getElementById('commentAuthGate');
    const commentForm = document.getElementById('commentForm');
    if (state.userSession) {
        if (authGate) authGate.classList.add('hidden');
        if (commentForm) commentForm.classList.remove('hidden');
    } else {
        if (authGate) authGate.classList.remove('hidden');
        if (commentForm) commentForm.classList.add('hidden');
    }

    openModal('promptDetailsModal');
}

// Fetch comments for a given prompt from the backend
async function fetchComments(promptId) {
    const thread = document.getElementById('commentsThread');
    const loader = document.getElementById('commentsLoader');
    const countBadge = document.getElementById('commentsCount');
    if (!thread) return;

    // Show loading spinner
    thread.innerHTML = `
        <div id="commentsLoader" class="flex items-center justify-center py-6 gap-3 text-white/30">
            <div class="w-5 h-5 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
            <span class="text-xs">Loading comments...</span>
        </div>`;

    try {
        const headers = {};
        if (state.userSession) {
            headers['Authorization'] = `Bearer ${state.userSession.session_id}`;
        }
        const res = await fetch(`${API_BASE}/api/prompts/${promptId}/comments`, { headers });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        renderComments(data.comments || []);
    } catch (err) {
        console.error('Failed to load comments:', err);
        if (thread) {
            thread.innerHTML = `
                <div class="text-center py-6 text-xs text-white/30">
                    <i class="fa-solid fa-triangle-exclamation text-white/20 mr-1"></i>
                    Could not load comments.
                </div>`;
        }
    }
}

// Render a list of comments into the thread container
function renderComments(comments) {
    const thread = document.getElementById('commentsThread');
    const countBadge = document.getElementById('commentsCount');
    if (!thread) return;

    if (countBadge) countBadge.textContent = comments.length;

    if (comments.length === 0) {
        thread.innerHTML = `
            <div class="text-center py-8 text-xs text-white/30 flex flex-col items-center gap-2">
                <i class="fa-regular fa-comment-dots text-2xl text-white/10"></i>
                No comments yet. Be the first to start the conversation!
            </div>`;
        return;
    }

    thread.innerHTML = '';
    comments.forEach(comment => {
        const initials = (comment.author_username || '?').substring(0, 2).toUpperCase();
        const rawDate = new Date(comment.created_at);
        const timeAgo = rawDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        const isOwn = state.userSession && state.userSession.user_id === comment.user_id;

        const el = document.createElement('div');
        el.className = `flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`;
        el.innerHTML = `
            <div class="flex-shrink-0 w-8 h-8 rounded-lg ${
                isOwn ? 'bg-indigo-600/20 text-indigo-400' : 'bg-white/5 text-white/50'
            } flex items-center justify-center font-bold text-xs">
                ${escapeHTML(initials)}
            </div>
            <div class="flex flex-col gap-1 max-w-[80%] ${isOwn ? 'items-end' : ''} ">
                <div class="flex items-center gap-2 ${isOwn ? 'flex-row-reverse' : ''}">
                    <span class="text-xs font-bold ${
                        isOwn ? 'text-indigo-400' : 'text-white/70'
                    }">${escapeHTML(comment.author_username || 'Anonymous')}</span>
                    <span class="text-[10px] text-white/25">${timeAgo}</span>
                </div>
                <div class="px-4 py-2.5 rounded-2xl ${
                    isOwn
                        ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-100 rounded-tr-sm'
                        : 'bg-white/5 border border-white/5 text-white/80 rounded-tl-sm'
                } text-sm leading-relaxed">
                    ${escapeHTML(comment.content)}
                </div>
            </div>`;
        thread.appendChild(el);
    });

    // Scroll to the bottom of thread to show latest
    thread.scrollTop = thread.scrollHeight;
}

// Submit a new comment for the currently open prompt
async function submitComment() {
    const input = document.getElementById('commentInput');
    const btn = document.getElementById('submitCommentBtn');
    if (!input || !state.userSession || !state.currentPromptId) return;

    const content = input.value.trim();
    if (!content) {
        showToast('Please write something before posting.', 'error');
        return;
    }

    // Disable button during submission
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Posting…';

    try {
        const res = await fetch(
            `${API_BASE}/api/prompts/${state.currentPromptId}/comments`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${state.userSession.session_id}`
                },
                body: JSON.stringify({ content })
            }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to post comment');

        // Clear input and re-fetch comments for live refresh
        input.value = '';
        await fetchComments(state.currentPromptId);
        showToast('Comment posted!', 'success');
    } catch (err) {
        showToast(err.message || 'Could not post comment.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-paper-plane mr-1"></i> Post';
    }
}
