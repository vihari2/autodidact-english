let blocoAtual = ''; 
let isRedirecting = false;
let authInitialized = false;

const SUPABASE_URL = 'https://cxwyrfngaslvehcodxij.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_NnWB7ZwtU-x4GMVwDLbVeA_mP2mIe99';

let supabaseClient = null;

function getSupabaseClient() {
    if (!supabaseClient && window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return supabaseClient;
}

function isSupabaseConfigured() {
    return !!(window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL !== 'SUA_URL_DO_SUPABASE' && SUPABASE_ANON_KEY !== 'SUA_CHAVE_ANON');
}

function getCurrentUserId() {
    if (!isSupabaseConfigured()) return null;
    return localStorage.getItem('supabase_user_id');
}

function setAuthStatus(message, isError = false) {
    const status = document.getElementById('auth-status');
    if (!status) return;
    status.textContent = message;
    status.style.color = isError ? '#b91c1c' : '#475569';
}

async function ensureProfile(user) {
    if (!user || !isSupabaseConfigured()) return;

    const client = getSupabaseClient();
    const { data, error } = await client
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error(error);
        return;
    }

    if (!data) {
        const { error: insertError } = await client.from('profiles').insert([
            {
                user_id: user.id,
                nome: user.email?.split('@')[0] || 'User',
                avatar_url: null
            }
        ]);

        if (insertError) {
            console.error(insertError);
        }
    }
}

async function loadProfileFromSupabase() {
    const userId = getCurrentUserId();
    if (!userId || !isSupabaseConfigured()) return;

    const client = getSupabaseClient();
    const { data, error } = await client
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error) {
        console.error(error);
        return;
    }

    const nomeTxt = document.getElementById('nome-txt');
    if (nomeTxt && data?.nome) {
        nomeTxt.textContent = data.nome;
        localStorage.setItem('nomeUsuario', data.nome);
    }

    if (data?.avatar_url && fotoImg) {
        fotoImg.src = data.avatar_url;
        localStorage.setItem('fotoPerfilCustom', data.avatar_url);
    }
}

async function saveNameToSupabase() {
    const userId = getCurrentUserId();
    if (!userId || !isSupabaseConfigured()) return;

    const nomeTag = document.getElementById('nome-txt');
    const nome = nomeTag ? nomeTag.textContent.trim() || 'Your Name Here' : 'Your Name Here';
    localStorage.setItem('nomeUsuario', nome);

    const client = getSupabaseClient();
    const { error } = await client
        .from('profiles')
        .upsert({ user_id: userId, nome }, { onConflict: 'user_id' });

    if (error) {
        console.error(error);
    }
}

async function saveAvatarToSupabase(file) {
    const userId = getCurrentUserId();
    if (!userId || !isSupabaseConfigured() || !file) return;

    const fileName = `${userId}-${Date.now()}.png`;
    const client = getSupabaseClient();

    const { error: uploadError } = await client.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

    if (uploadError) {
        console.error(uploadError);
        return;
    }

    const { data: publicUrlData } = client.storage
        .from('avatars')
        .getPublicUrl(fileName);

    const avatarUrl = publicUrlData?.publicUrl;

    if (avatarUrl) {
        const { error } = await client
            .from('profiles')
            .upsert({ user_id: userId, avatar_url: avatarUrl }, { onConflict: 'user_id' });

        if (error) {
            console.error(error);
        }
    }
}

async function signUpWithEmail() {
    const email = document.getElementById('email-input')?.value?.trim();
    const password = document.getElementById('password-input')?.value?.trim();

    if (!email || !password) {
        setAuthStatus('Please enter email and password.', true);
        return;
    }

    if (!isSupabaseConfigured()) {
        setAuthStatus('Configure Supabase to enable multi-user login.', true);
        return;
    }

    const client = getSupabaseClient();
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) {
        setAuthStatus(error.message, true);
        return;
    }

    if (data?.user) {
        localStorage.setItem('supabase_user_id', data.user.id);
        await ensureProfile(data.user);
    }

    setAuthStatus('Account created. Check your email to confirm your registration, then sign in.');
}

async function signInWithEmail() {
    const email = document.getElementById('email-input')?.value?.trim();
    const password = document.getElementById('password-input')?.value?.trim();

    if (!email || !password) {
        setAuthStatus('Please enter email and password.', true);
        return;
    }

    if (!isSupabaseConfigured()) {
        setAuthStatus('Configure Supabase to enable multi-user login.', true);
        return;
    }

    const client = getSupabaseClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
        setAuthStatus(error.message, true);
        return;
    }

    if (data?.user) {
        localStorage.setItem('supabase_user_id', data.user.id);
        await ensureProfile(data.user);
        await loadProfileFromSupabase();
        setAuthStatus(`Connected as ${data.user.email}`);
        updateAuthUI();
        setTimeout(() => {
            isRedirecting = true;
            window.location.href = 'dashboard.html';
        }, 1500);
        return;
    }

    setAuthStatus('Could not sign in.', true);
}

async function signOut() {
    const client = getSupabaseClient();
    
    if (isSupabaseConfigured() && client?.auth) {
        await client.auth.signOut();
    }

    localStorage.removeItem('supabase_user_id');
    updateAuthUI();
    
    setTimeout(() => {
        isRedirecting = true;
        window.location.href = 'index.html';
    }, 300);
}

function updateAuthUI() {
    const logoutBtn = document.getElementById('auth-logout');
    const submitBtn = document.getElementById('auth-submit');
    const signupBtn = document.getElementById('auth-signup');

    if (!logoutBtn || !submitBtn || !signupBtn) return;

    const loggedIn = isSupabaseConfigured() && !!localStorage.getItem('supabase_user_id');
    logoutBtn.classList.toggle('hidden', !loggedIn);
    signupBtn.classList.toggle('hidden', loggedIn);
    submitBtn.textContent = 'Enter';
}

function initAuth() {
    // Evita executar mais de uma vez
    if (authInitialized) return;
    authInitialized = true;

    // Redirecionamento desabilitado temporariamente
    // if (isSupabaseConfigured() && localStorage.getItem('supabase_user_id') && !isRedirecting) {
    //     isRedirecting = true;
    //     window.location.href = 'index.html';
    //     return;
    // }

    const form = document.getElementById('auth-form');
    const signUpBtn = document.getElementById('auth-signup');
    const logoutBtn = document.getElementById('auth-logout');

    if (form) {
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            signInWithEmail();
        });
    }

    if (signUpBtn) {
        signUpBtn.addEventListener('click', signUpWithEmail);
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', signOut);
    }

    updateAuthUI();

    if (!isSupabaseConfigured()) {
        setAuthStatus('Configure Supabase to enable multi-user login.');
    }
}

window.signUpWithEmail = signUpWithEmail;
window.signInWithEmail = signInWithEmail;
window.signOut = signOut;

function hideDevBanner() {
    const banner = document.querySelector('.dev-banner');
    if (banner) {
        banner.classList.add('hidden');
    }
}

function showDevBanner() {
    const banner = document.querySelector('.dev-banner');
    if (banner) {
        banner.classList.remove('hidden');
    }
}

function abrirAnotacao(nomeBloco) {
    blocoAtual = nomeBloco;
    hideDevBanner();
    document.getElementById('modal-titulo').innerText = nomeBloco;
    
    const areaConteudo = document.getElementById('modal-conteudo');
    areaConteudo.innerHTML = ''; 

    if (nomeBloco === 'Flashcards') {
        renderizarTabelaFlashcards(areaConteudo);
    } else if (nomeBloco === 'Google Meet') {
        renderizarGoogleMeet(areaConteudo);
    } else if (nomeBloco === 'Other Resources') {
        renderizarOtherResources(areaConteudo);
    } else if (nomeBloco === 'Writing Journal') {
        renderizarWritingJournal(areaConteudo);
    } else if (nomeBloco === 'My Coursebook') {
        renderizarCoursebook(areaConteudo);
    } else {
        renderizarBlocoDeTexto(areaConteudo, nomeBloco);
    }

    document.getElementById('modal').style.display = 'flex';
}

function fecharModal() {
    if (blocoAtual === 'Google Meet') {
        const obsTexto = document.getElementById('obs-meet');
        if (obsTexto) {
            localStorage.setItem('obs_Google Meet', obsTexto.value);
        }
    } else if (blocoAtual !== 'Flashcards' && blocoAtual !== 'Other Resources' && blocoAtual !== 'Google Meet' && blocoAtual !== 'Writing Journal' && blocoAtual !== 'My Coursebook') {
        const campoTexto = document.getElementById('modal-texto');
        if (campoTexto) {
            localStorage.setItem('notas_' + blocoAtual, campoTexto.value);
        }
    }
    
    document.getElementById('modal').style.display = 'none';
    showDevBanner();
}

function salvarNome() {
    const nomeTag = document.getElementById('nome-txt');
    if (!nomeTag) return;
    const nome = nomeTag.textContent.trim() || 'Your Name Here';
    localStorage.setItem('nomeUsuario', nome);

    if (isSupabaseConfigured()) {
        saveNameToSupabase();
    }
}

// -- Bloco de Texto Genérico --
function renderizarBlocoDeTexto(container, nomeBloco) {
    const textoSalvo = localStorage.getItem('notas_' + nomeBloco) || '';
    container.innerHTML = `<textarea id="modal-texto" placeholder="Write your notes here...">${textoSalvo}</textarea>`;
}

// -- Flashcards --
function renderizarTabelaFlashcards(container) {
    container.innerHTML = `
        <button class="btn-adicionar-linha" onclick="adicionarNovaPalavra()">+ New Word</button>
        <div class="flashcards-container">
            <table class="tabela-flashcards" style="margin-top: 15px;">
                <thead>
                    <tr>
                        <th>Word</th>
                        <th>Category</th>
                        <th>Meaning</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody id="corpo-tabela-flashcards">
                </tbody>
            </table>
        </div>
    `;
    carregarFlashcardsSalvos();
}

function carregarFlashcardsSalvos() {
    const corpoTabela = document.getElementById('corpo-tabela-flashcards');
    let flashcards = JSON.parse(localStorage.getItem('meusFlashcards')) || [];
    
    corpoTabela.innerHTML = '';
    flashcards.forEach((item, index) => {
        corpoTabela.innerHTML += `
            <tr>
                <td><input type="text" class="input-meet" value="${item.word || ''}" onchange="salvarEdicaoFlashcard(${index}, 'word', this.value)" placeholder="Ex: blood"></td>
                <td><input type="text" class="input-meet" value="${item.category || ''}" onchange="salvarEdicaoFlashcard(${index}, 'category', this.value)" placeholder="Ex: Vocabulary"></td>
                <td><input type="text" class="input-meet" value="${item.meaning || ''}" onchange="salvarEdicaoFlashcard(${index}, 'meaning', this.value)" placeholder="Ex: sangue"></td>
                <td><button class="btn-remover" onclick="removerFlashcard(${index})">X</button></td>
            </tr>
        `;
    });
}

function adicionarNovaPalavra() {
    let flashcards = JSON.parse(localStorage.getItem('meusFlashcards')) || [];
    flashcards.push({ word: '', category: '', meaning: '' });
    localStorage.setItem('meusFlashcards', JSON.stringify(flashcards));
    carregarFlashcardsSalvos();
}

function salvarEdicaoFlashcard(index, campo, novoValor) {
    let flashcards = JSON.parse(localStorage.getItem('meusFlashcards')) || [];
    flashcards[index][campo] = novoValor;
    localStorage.setItem('meusFlashcards', JSON.stringify(flashcards));
}

function removerFlashcard(index) {
    let flashcards = JSON.parse(localStorage.getItem('meusFlashcards')) || [];
    flashcards.splice(index, 1);
    localStorage.setItem('meusFlashcards', JSON.stringify(flashcards));
    carregarFlashcardsSalvos();
}

// -- Other Resources --
function renderizarOtherResources(container) {
    container.innerHTML = `
        <div style="max-height: 450px; overflow-y: auto; padding-right: 10px; font-size: 0.9em;">
            <h3 style="color: #1a73e8; margin-top: 0;">🌐 Online Tools & Utilities</h3>
            <table class="tabela-meet" style="margin-bottom: 20px;">
                <tr><th>Resource</th><th>Purpose</th></tr>
                <tr><td><b>Google Translate / Reverso</b></td><td>Quick reverse-translation & synonyms.</td></tr>
                <tr><td><b>EF SET</b></td><td>Free 50-minute level assessment exam.</td></tr>
                <tr><td><b>YouGlish</b></td><td>Hear real native pronunciation via YouTube.</td></tr>
            </table>

            <h3 style="color: #1a73e8;">📖 English Books by CEFR Level</h3>
            <table class="tabela-meet" style="margin-bottom: 20px;">
                <tr><th>Level</th><th>Title</th></tr>
                <tr><td><b>A1</b></td><td>The Very Hungry Caterpillar, The Cat in the Hat, Charlotte's Web</td></tr>
                <tr><td><b>A2</b></td><td>Charlie and the Chocolate Factory, Matilda, The Giver</td></tr>
                <tr><td><b>B1</b></td><td>The Hunger Games, To Kill a Mockingbird, Harry Potter</td></tr>
                <tr><td><b>B2</b></td><td>The Hobbit, 1984, The Alchemist, Fahrenheit 451</td></tr>
                <tr><td><b>C1</b></td><td>Pride and Prejudice, Game of Thrones, Jane Eyre</td></tr>
                <tr><td><b>C2</b></td><td>Lolita, The Handmaid's Tale, Little Women</td></tr>
            </table>
        </div>
    `;
}

// -- Google Meet --
function renderizarGoogleMeet(container) {
    container.innerHTML = `
        <div style="max-height: 500px; overflow-y: auto; padding-right: 5px;">
            <h4 style="margin: 0 0 10px 0; color: #555;">Meet Sessions</h4>
            <button class="btn-adicionar-linha" onclick="adicionarLinhaMeet()">+ New Session</button>
            <table class="tabela-meet" style="margin-bottom: 20px;">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Topic</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody id="corpo-tabela-meet">
                </tbody>
            </table>

            <hr style="border: none; border-top: 2px solid #eaeaea; margin: 25px 0 20px 0;">

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h4 style="margin: 0; color: #555;">Observation Journal</h4>
                <button class="btn-adicionar-linha" onclick="adicionarNotaMeet()" style="margin: 0;">+ New Note</button>
            </div>
            
            <table class="tabela-meet">
                <thead>
                    <tr>
                        <th style="width: 25%;">Date</th>
                        <th>Observation / Note</th>
                        <th style="width: 10%;"></th>
                    </tr>
                </thead>
                <tbody id="corpo-tabela-notas-meet">
                </tbody>
            </table>
        </div>
    `;
    
    carregarMeetSalvos();
    carregarNotasMeetSalvas();
}

function carregarMeetSalvos() {
    const corpoTabela = document.getElementById('corpo-tabela-meet');
    if (!corpoTabela) return;
    let sessoes = JSON.parse(localStorage.getItem('meuMeet')) || [];
    
    corpoTabela.innerHTML = '';
    sessoes.forEach((item, index) => {
        corpoTabela.innerHTML += `
            <tr>
                <td><input type="text" class="input-meet" value="${item.name}" onchange="salvarEdicaoMeet(${index}, 'name', this.value)" placeholder="Session 1"></td>
                <td><input type="date" class="input-meet" value="${item.date}" onchange="salvarEdicaoMeet(${index}, 'date', this.value)"></td>
                <td>
                    <select class="input-meet" onchange="salvarEdicaoMeet(${index}, 'status', this.value)">
                        <option value="Not started" ${item.status === 'Not started' ? 'selected' : ''}>Not started</option>
                        <option value="In progress" ${item.status === 'In progress' ? 'selected' : ''}>In progress</option>
                        <option value="Done" ${item.status === 'Done' ? 'selected' : ''}>Done</option>
                    </select>
                </td>
                <td><input type="text" class="input-meet" value="${item.topic}" onchange="salvarEdicaoMeet(${index}, 'topic', this.value)" placeholder="Topic..."></td>
                <td><button class="btn-remover" onclick="removerMeet(${index})">X</button></td>
            </tr>
        `;
    });
}

function adicionarLinhaMeet() {
    let sessoes = JSON.parse(localStorage.getItem('meuMeet')) || [];
    sessoes.push({ name: '', date: '', status: 'Not started', topic: '' });
    localStorage.setItem('meuMeet', JSON.stringify(sessoes));
    carregarMeetSalvos();
}

function salvarEdicaoMeet(index, campo, novoValor) {
    let sessoes = JSON.parse(localStorage.getItem('meuMeet')) || [];
    sessoes[index][campo] = novoValor;
    localStorage.setItem('meuMeet', JSON.stringify(sessoes));
}

function removerMeet(index) {
    let sessoes = JSON.parse(localStorage.getItem('meuMeet')) || [];
    sessoes.splice(index, 1);
    localStorage.setItem('meuMeet', JSON.stringify(sessoes));
    carregarMeetSalvos();
}

function carregarNotasMeetSalvas() {
    const corpoTabelaNotas = document.getElementById('corpo-tabela-notas-meet');
    if (!corpoTabelaNotas) return;
    let notas = JSON.parse(localStorage.getItem('diarioNotasMeet')) || [];
    
    corpoTabelaNotas.innerHTML = '';
    notas.forEach((item, index) => {
        corpoTabelaNotas.innerHTML += `
            <tr>
                <td><input type="date" class="input-meet" value="${item.data}" onchange="salvarEdicaoNotaMeet(${index}, 'data', this.value)"></td>
                <td><textarea class="textarea-meet" onchange="salvarEdicaoNotaMeet(${index}, 'texto', this.value)" oninput="autoGrowTextarea(this)" placeholder="Write your observation here...">${item.texto}</textarea></td>
                <td><button class="btn-remover" onclick="removerNotaMeet(${index})">X</button></td>
            </tr>
        `;
    });
    // Trigger auto-grow for loaded textareas
    document.querySelectorAll('.textarea-meet').forEach(ta => autoGrowTextarea(ta));
}

function adicionarNotaMeet() {
    let notas = JSON.parse(localStorage.getItem('diarioNotasMeet')) || [];
    let dataHoje = new Date().toISOString().split('T')[0];
    notas.push({ data: dataHoje, texto: '' });
    localStorage.setItem('diarioNotasMeet', JSON.stringify(notas));
    carregarNotasMeetSalvas();
}

function salvarEdicaoNotaMeet(index, campo, novoValor) {
    let notas = JSON.parse(localStorage.getItem('diarioNotasMeet')) || [];
    notas[index][campo] = novoValor;
    localStorage.setItem('diarioNotasMeet', JSON.stringify(notas));
}

function removerNotaMeet(index) {
    let notas = JSON.parse(localStorage.getItem('diarioNotasMeet')) || [];
    notas.splice(index, 1);
    localStorage.setItem('diarioNotasMeet', JSON.stringify(notas));
    carregarNotasMeetSalvas();
}

function autoGrowTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.max(textarea.scrollHeight, 40) + 'px';
}

// -- Writing Journal --
function renderizarWritingJournal(container) {
    container.innerHTML = `
        <div style="max-height: 450px; overflow-y: auto; padding-right: 5px;">
            <button class="btn-adicionar-linha" onclick="adicionarRegistroJournal()">+ Add Day</button>
            <table class="tabela-meet" style="margin-top: 15px;">
                <thead>
                    <tr>
                        <th style="width: 40%;">Date</th>
                        <th>Wrote in the journal?</th>
                        <th style="width: 10%;"></th>
                    </tr>
                </thead>
                <tbody id="corpo-tabela-journal">
                </tbody>
            </table>
        </div>
    `;
    carregarJournalSalvo();
}

function carregarJournalSalvo() {
    const corpoTabela = document.getElementById('corpo-tabela-journal');
    if (!corpoTabela) return;
    let registros = JSON.parse(localStorage.getItem('meuWritingJournal')) || [];
    
    corpoTabela.innerHTML = '';
    registros.forEach((item, index) => {
        corpoTabela.innerHTML += `
            <tr>
                <td><input type="date" class="input-meet" value="${item.data}" onchange="salvarEdicaoJournal(${index}, 'data', this.value)"></td>
                <td>
                    <select class="input-meet" onchange="salvarEdicaoJournal(${index}, 'feito', this.value)">
                        <option value="Sim" ${item.feito === 'Sim' ? 'selected' : ''}>✅ Yes, I wrote</option>
                        <option value="Não" ${item.feito === 'Não' ? 'selected' : ''}>❌ No, I did not write</option>
                    </select>
                </td>
                <td><button class="btn-remover" onclick="removerJournal(${index})">X</button></td>
            </tr>
        `;
    });
}

function adicionarRegistroJournal() {
    let registros = JSON.parse(localStorage.getItem('meuWritingJournal')) || [];
    let dataHoje = new Date().toISOString().split('T')[0];
    registros.push({ data: dataHoje, feito: 'Sim' });
    localStorage.setItem('meuWritingJournal', JSON.stringify(registros));
    carregarJournalSalvo();
}

function salvarEdicaoJournal(index, campo, novoValor) {
    let registros = JSON.parse(localStorage.getItem('meuWritingJournal')) || [];
    registros[index][campo] = novoValor;
    localStorage.setItem('meuWritingJournal', JSON.stringify(registros));
}

function removerJournal(index) {
    let registros = JSON.parse(localStorage.getItem('meuWritingJournal')) || [];
    registros.splice(index, 1);
    localStorage.setItem('meuWritingJournal', JSON.stringify(registros));
    carregarJournalSalvo();
}

// -- My Coursebook --
function renderizarCoursebook(container) {
    container.innerHTML = `
        <div style="max-height: 450px; overflow-y: auto; padding-right: 5px;">
            <button class="btn-adicionar-linha" onclick="adicionarLivroCoursebook()">+ Add Book</button>
            <table class="tabela-meet" style="margin-top: 15px;">
                <thead>
                    <tr>
                        <th style="width: 40%;">Book Name</th>
                        <th style="width: 25%;">Page/Chapter</th>
                        <th style="width: 25%;">Date</th>
                        <th style="width: 10%;"></th>
                    </tr>
                </thead>
                <tbody id="corpo-tabela-coursebook">
                </tbody>
            </table>
        </div>
    `;
    carregarCoursebookSalvo();
}

function carregarCoursebookSalvo() {
    const corpoTabela = document.getElementById('corpo-tabela-coursebook');
    if (!corpoTabela) return;
    let livros = JSON.parse(localStorage.getItem('meuCoursebook')) || [];
    
    corpoTabela.innerHTML = '';
    livros.forEach((item, index) => {
        corpoTabela.innerHTML += `
            <tr>
                <td><input type="text" class="input-meet" value="${item.nome}" onchange="salvarEdicaoCoursebook(${index}, 'nome', this.value)" placeholder="Ex: English Grammar in Use"></td>
                <td><input type="text" class="input-meet" value="${item.parada}" onchange="salvarEdicaoCoursebook(${index}, 'parada', this.value)" placeholder="Ex: Cap. 4 / Pág. 45"></td>
                <td><input type="date" class="input-meet" value="${item.data}" onchange="salvarEdicaoCoursebook(${index}, 'data', this.value)"></td>
                <td><button class="btn-remover" onclick="removerCoursebook(${index})">X</button></td>
            </tr>
        `;
    });
}

function adicionarLivroCoursebook() {
    let livros = JSON.parse(localStorage.getItem('meuCoursebook')) || [];
    let dataHoje = new Date().toISOString().split('T')[0];
    livros.push({ nome: '', parada: '', data: dataHoje });
    localStorage.setItem('meuCoursebook', JSON.stringify(livros));
    carregarCoursebookSalvo();
}

function salvarEdicaoCoursebook(index, campo, novoValor) {
    let livros = JSON.parse(localStorage.getItem('meuCoursebook')) || [];
    livros[index][campo] = novoValor;
    localStorage.setItem('meuCoursebook', JSON.stringify(livros));
}

function removerCoursebook(index) {
    let livros = JSON.parse(localStorage.getItem('meuCoursebook')) || [];
    livros.splice(index, 1);
    localStorage.setItem('meuCoursebook', JSON.stringify(livros));
    carregarCoursebookSalvo();
}

// --- Lógica para salvar a foto do avatar ---
const fotoImg = document.getElementById('foto-img');
const uploadFoto = document.getElementById('upload-foto');

function loadProfileData() {
    const nomeSalvo = localStorage.getItem('nomeUsuario');
    const nomeTxt = document.getElementById('nome-txt');
    if (nomeTxt) {
        nomeTxt.textContent = nomeSalvo || 'Your Name Here';
    }

    const fotoSalva = localStorage.getItem('fotoPerfilCustom');
    if (fotoSalva && fotoImg) {
        fotoImg.src = fotoSalva;
    }

    const gatoSalvo = localStorage.getItem('fotoGatoCustom');
    if (gatoSalvo && imgGato) {
        imgGato.src = gatoSalvo;
    }
}

function redirectIfNeeded() {
    if (isRedirecting) return;
    
    const isLoginPage = window.location.pathname.endsWith('index.html');
    const isLoggedIn = !!localStorage.getItem('supabase_user_id');

    if (!isLoginPage && !isLoggedIn) {
        isRedirecting = true;
        window.location.href = 'index.html';
        return;
    }

    if (isLoginPage && isLoggedIn) {
        isRedirecting = true;
        window.location.href = 'dashboard.html';
    }
}

window.addEventListener('DOMContentLoaded', () => {
    initAuth();
});

window.addEventListener('load', () => {
    // redirectIfNeeded(); // DESABILITADO TEMPORARIAMENTE
    loadProfileData();
});

if (fotoImg && uploadFoto) {
    fotoImg.addEventListener('click', () => uploadFoto.click());

    uploadFoto.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            const dataUrl = event.target.result;
            fotoImg.src = dataUrl;
            localStorage.setItem('fotoPerfilCustom', dataUrl);
        };
        reader.readAsDataURL(file);

        if (isSupabaseConfigured()) {
            await saveAvatarToSupabase(file);
        }
    });
}

// --- Lógica para salvar a foto do gatinho ---
const imgGato = document.getElementById('img-gato');
const uploadGato = document.getElementById('upload-gato');

if (imgGato && uploadGato) {
    imgGato.addEventListener('click', () => uploadGato.click());

    uploadGato.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                const dataUrl = event.target.result;
                imgGato.src = dataUrl;
                localStorage.setItem('fotoGatoCustom', dataUrl);
            };
            reader.readAsDataURL(file);
        }
    });
}