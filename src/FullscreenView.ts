import * as vscode from 'vscode';
const REFRESH_INTERVAL = 7000;

export class FullscreenView {
    private panel?: vscode.WebviewPanel;
    private static activeViews: Set<FullscreenView> = new Set();

    constructor(private token: string, private extensionUri: vscode.Uri) {
        FullscreenView.activeViews.add(this);
    }

    public updateToken(newToken: string) {
        this.token = newToken;
        this.panel?.webview.postMessage({ type: 'updateToken', token: newToken });
    }

    public show() {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'spoticodeFullscreen',
            'Spoticode - Músicas',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [this.extensionUri]
            }
        );

        this.panel.iconPath = vscode.Uri.joinPath(this.extensionUri, 'resources', 'spoticode-logo.png');

        this.panel.onDidDispose(() => {
            FullscreenView.activeViews.delete(this);
            this.panel = undefined;
        });

        this.panel.webview.onDidReceiveMessage(async (message) => {
            if (message.type === 'play') {
                try {
                    const data: any = {};
                    if (Array.isArray(message.uris)) {
                        data.uris = message.uris;
                        if (message.offset) {
                            data.offset = { uri: message.offset };
                        }
                    } else if (message.uri && message.uri.includes('playlist')) {
                        data.context_uri = message.uri;
                    } else if (message.uri) {
                        data.uris = [message.uri];
                    }
                    await fetch('https://api.spotify.com/v1/me/player/play', {
                        method: 'PUT',
                        headers: { 'Authorization': 'Bearer ' + this.token },
                        body: JSON.stringify(data)
                    });
                    vscode.window.showInformationMessage('Spoticode: Reproduzindo...');
                } catch (e: any) {
                    console.error('Play error', e);
                    vscode.window.showErrorMessage('Spoticode: Erro ao reproduzir. Verifique se o Spotify está aberto.');
                }
            } else if (message.type === 'addToQueue') {
                try {
                    await fetch('https://api.spotify.com/v1/me/player/queue?uri=' + message.uri, {
                        method: 'POST',
                        headers: { 'Authorization': 'Bearer ' + this.token }
                    });
                    vscode.window.showInformationMessage('Spoticode: Adicionado à fila!');
                } catch (e: any) {
                    console.error('Queue error', e.response?.data || e);
                    vscode.window.showErrorMessage('Spoticode: Erro ao adicionar à fila.');
                }
            }
        });

        this.panel.webview.html = this.getHtml();
    }

    public static refreshAll() {
        for (const view of this.activeViews) {
            view.panel?.webview.postMessage({ type: 'refresh' });
        }
    }

    public static updateTokenAll(token: string) {
        for (const view of this.activeViews) {
            view.updateToken(token);
        }
    }

    private getHtml() {
        const logoUri = this.panel?.webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'resources', 'spoticode-logo.png'));

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <style>
                    body {
                        background-color: #121212;
                        color: #ffffff;
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        margin: 0;
                        padding: 32px;
                    }
                    h1 { font-size: 32px; font-weight: 800; margin: 0; }
                    .header-user {
                        display: flex;
                        align-items: center;
                        gap: 16px;
                        margin-bottom: 24px;
                    }
                    .user-info {
                        display: flex;
                        flex-direction: column;
                        gap: 4px;
                    }
                    #userName {
                        margin: 0;
                        font-size: 14px;
                        color: #b3b3b3;
                        font-weight: 500;
                    }
                    .header-user img {
                        width: 56px;
                        height: 56px;
                        border-radius: 50%;
                        object-fit: cover;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                    }
                    .tabs { display: flex; gap: 16px; margin-bottom: 32px; }
                    .tab {
                        background: none; border: none; color: #b3b3b3; font-size: 14px; 
                        font-weight: 700; cursor: pointer; padding: 8px 16px; border-radius: 20px;
                        transition: all 0.2s;
                    }
                    .tab.active { background: #333; color: #fff; }
                    .tab:hover:not(.active) { color: #fff; }
                    
                    .search-container {
                        margin-bottom: 32px;
                        position: relative;
                        width: 100%;
                        max-width: 400px;
                    }
                    .search-input {
                        width: 100%;
                        background: #242424;
                        border: none;
                        padding: 12px 16px 12px 48px;
                        border-radius: 24px;
                        color: #fff;
                        font-size: 14px;
                        outline: none;
                        transition: background-color 0.2s;
                    }
                    .search-input:focus {
                        background: #2a2a2a;
                        box-shadow: 0 0 0 2px #fff;
                    }
                    .search-icon {
                        position: absolute;
                        left: 16px;
                        top: 50%;
                        transform: translateY(-50%);
                        color: #b3b3b3;
                        pointer-events: none;
                    }
                    
                    .grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                        gap: 24px;
                    }
                    .card {
                        background: #181818;
                        padding: 16px;
                        border-radius: 8px;
                        transition: background-color 0.3s ease;
                        cursor: pointer;
                        position: relative;
                    }
                    .card:hover { background: #282828; }
                    .card img {
                        width: 100%;
                        aspect-ratio: 1;
                        object-fit: cover;
                        border-radius: 4px;
                        margin-bottom: 16px;
                        box-shadow: 0 8px 24px rgba(0,0,0,0.5);
                    }
                    .card-title {
                        font-weight: 700;
                        font-size: 16px;
                        margin-bottom: 4px;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                    .card-subtitle {
                        font-size: 14px;
                        color: #b3b3b3;
                        display: -webkit-box;
                        -webkit-line-clamp: 2;
                        -webkit-box-orient: vertical;
                        overflow: hidden;
                    }
                    .btn-play {
                        position: absolute;
                        bottom: 80px;
                        right: 24px;
                        background: #1ed760;
                        color: #000;
                        border: none;
                        border-radius: 50%;
                        width: 48px;
                        height: 48px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        opacity: 0;
                        transform: translateY(8px);
                        transition: all 0.3s ease;
                        box-shadow: 0 8px 8px rgba(0,0,0,0.3);
                        cursor: pointer;
                    }
                    .card:hover .btn-play {
                        opacity: 1;
                        transform: translateY(0);
                    }
                    .btn-play:hover {
                        transform: scale(1.05) !important;
                        background: #1fdf64;
                    }
                    .btn-add-queue {
                        position: absolute;
                        bottom: 80px;
                        left: 24px;
                        background: #333;
                        color: #fff;
                        border: none;
                        border-radius: 50%;
                        width: 48px;
                        height: 48px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        opacity: 0;
                        transform: translateY(8px);
                        transition: all 0.3s ease;
                        box-shadow: 0 8px 8px rgba(0,0,0,0.3);
                        cursor: pointer;
                    }
                    .card:hover .btn-add-queue {
                        opacity: 1;
                        transform: translateY(0);
                    }
                    .btn-add-queue:hover {
                        transform: scale(1.05) !important;
                        background: #444;
                    }
                    .queue-title {
                        width: 100%;
                        grid-column: 1 / -1;
                        font-size: 20px;
                        font-weight: 700;
                        margin-top: 24px;
                        border-bottom: 1px solid #333;
                        padding-bottom: 8px;
                    }
                    .loading-container {
                        grid-column: 1 / -1;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        align-items: center;
                        padding: 100px 0;
                        gap: 16px;
                    }
                    .spinner {
                        width: 40px;
                        height: 40px;
                        border: 4px solid #282828;
                        border-top: 4px solid #1ed760;
                        border-radius: 50%;
                        animation: spin 0.8s linear infinite;
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    .loading-text { font-size: 14px; color: #b3b3b3; font-weight: 500; }
                    .load-more-container {
                        grid-column: 1 / -1;
                        display: flex;
                        justify-content: center;
                        padding: 32px 0;
                    }
                    .btn-load-more {
                        background: #333;
                        color: #fff;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 24px;
                        font-weight: 700;
                        cursor: pointer;
                        font-size: 14px;
                        transition: background 0.2s;
                    }
                    .btn-load-more:hover {
                        background: #444;
                        transform: scale(1.02);
                    }
                    .logo-top-right {
                        position: fixed;
                        top: 32px;
                        right: 32px;
                        width: 80px;
                        height: 80px;
                        object-fit: contain;
                        opacity: 0.9;
                        pointer-events: none;
                        filter: drop-shadow(0 4px 12px rgba(0,0,0,0.5));
                        z-index: 100;
                    }
                </style>
            </head>
            <body>
                <img src="${logoUri}" class="logo-top-right" alt="Spoticode Logo"/>
                <div class="header-user">
                    <img id="userImg" src="${logoUri}" alt="User Avatar" />
                    <div class="user-info">
                        <h1>Spoticode - Músicas</h1>
                        <p id="userName">Logado como: [...]</p>
                    </div>
                </div>
                <div class="search-container">
                    <svg class="search-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M10.533 1.279c-5.18 0-9.407 4.14-9.407 9.279s4.226 9.279 9.407 9.279c2.234 0 4.29-.77 5.907-2.046l4.274 4.22a.75.75 0 1 0 1.06-1.06l-4.244-4.19c1.472-1.624 2.364-3.771 2.364-6.14 0-5.14-4.226-9.282-9.407-9.282zm0 1.5c4.329 0 7.907 3.493 7.907 7.78s-3.578 7.78-7.907 7.78-7.907-3.493-7.907-7.78 3.578-7.78 7.907-7.78z"/></svg>
                    <input type="text" id="searchInput" class="search-input" placeholder="O que você quer ouvir?">
                </div>
                <div class="tabs">
                    <button class="tab" data-type="search" id="tabSearch" style="display:none;">Busca</button>
                    <button class="tab active" data-type="liked">Músicas Curtidas</button>
                    <button class="tab" data-type="playlists">Playlists</button>
                    <button class="tab" data-type="top">Mais Tocadas</button>
                    <button class="tab" data-type="recent">Tocadas Recentemente</button>
                    <button class="tab" data-type="queue">Fila</button>
                </div>
                
                <div id="playAllContainer" style="display: none; margin-bottom: 24px;">
                    <button id="btnPlayAllLiked" style="background:#1ed760; color:#000; border:none; padding:12px 32px; border-radius:30px; font-weight:700; font-size:16px; cursor:pointer; display:flex; align-items:center; gap:8px;">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M7.05 3.606l13.49 7.788a.7.7 0 0 1 0 1.212L7.05 20.394A.7.7 0 0 1 6 19.788V4.212a.7.7 0 0 1 1.05-.606z"/></svg>
                        Reproduzir
                    </button>
                </div>

                <div id="content" class="grid">
                    <div class="loading-container">
                        <div class="spinner"></div>
                        <div class="loading-text">Buscando suas músicas...</div>
                    </div>
                </div>
                <div id="loadMoreContainer" class="load-more-container" style="display: none;">
                    <button id="btnLoadMore" class="btn-load-more">Carregar mais</button>
                </div>

                <script>
                    const vscode = acquireVsCodeApi();
                    const token = '${this.token}';
                    const REFRESH_INTERVAL = ${REFRESH_INTERVAL};
                    const content = document.getElementById('content');
                    const tabs = document.querySelectorAll('.tab');
                    const searchInput = document.getElementById('searchInput');
                    const tabSearch = document.getElementById('tabSearch');
                    const loadMoreContainer = document.getElementById('loadMoreContainer');
                    const btnLoadMore = document.getElementById('btnLoadMore');
                    
                    let currentOffset = 0;
                    let currentLoadedType = '';
                    let currentSearchQuery = '';

                    let searchTimeout;
                    searchInput.addEventListener('input', (e) => {
                        const q = e.target.value.trim();
                        if (q.length === 0) {
                            tabSearch.style.display = 'none';
                            return;
                        }
                        
                        tabSearch.style.display = 'inline-block';
                        tabs.forEach(t => t.classList.remove('active'));
                        tabSearch.classList.add('active');
                        
                        clearTimeout(searchTimeout);
                        searchTimeout = setTimeout(() => {
                            loadContent('search', q);
                        }, 500);
                    });
                    
                    const iconPlay = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M7.05 3.606l13.49 7.788a.7.7 0 0 1 0 1.212L7.05 20.394A.7.7 0 0 1 6 19.788V4.212a.7.7 0 0 1 1.05-.606z"/></svg>';
                    const iconAddQueue = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>';

                    async function fetchSpotify(endpoint) {
                        const res = await fetch('https://api.spotify.com/v1' + endpoint, {
                            headers: { 'Authorization': 'Bearer ' + token }
                        });
                        if (!res.ok) {
                            const err = await res.json();
                            throw new Error(err.error?.message || 'Failed to fetch');
                        }
                        return res.json();
                    }

                    let currentUris = [];
                    const playAllContainer = document.getElementById('playAllContainer');
                    const btnPlayAllLiked = document.getElementById('btnPlayAllLiked');
                    
                    btnPlayAllLiked.addEventListener('click', () => {
                        if (currentUris.length > 0) vscode.postMessage({ type: 'play', uris: currentUris });
                    });

                    btnLoadMore.addEventListener('click', () => {
                        currentOffset += 50;
                        loadContent(currentLoadedType, currentSearchQuery, true);
                    });

                    function renderItems(items, type, isAppend = false) {
                        playAllContainer.style.display = type === 'tracks' ? 'block' : 'none';
                        if (type === 'tracks') {
                            if (isAppend) currentUris = [...currentUris, ...items.map(i => i.uri)];
                            else currentUris = items.map(i => i.uri);
                        } else if (!isAppend) {
                            currentUris = [];
                        }

                        if (!items || items.length === 0) {
                            if (!isAppend) content.innerHTML = '<div class="loading">Nenhum item encontrado.</div>';
                            loadMoreContainer.style.display = 'none';
                            return;
                        }

                        loadMoreContainer.style.display = items.length === 50 ? 'flex' : 'none';

                        const html = items.map(item => {
                            let imgUrl = '${logoUri}';
                            if (type === 'playlists' && item.images && item.images.length > 0) imgUrl = item.images[0].url;
                            if (type !== 'playlists' && item.album && item.album.images && item.album.images.length > 0) imgUrl = item.album.images[0].url;
                            
                            const title = item.name;
                            let subtitle = '';
                            if (type === 'playlists') subtitle = 'De ' + (item.owner?.display_name || 'Spotify');
                            else subtitle = (item.artists || []).map(a => a.name).join(', ');

                            const isTrack = type === 'tracks' || type === 'queue';
                            const btnQueue = isTrack ? \`<button class="btn-add-queue" onclick="event.stopPropagation(); addToQueue('\${item.uri}')">\${iconAddQueue}</button>\` : '';

                            return \`
                                <div class="card" onclick="play('\${item.uri}')">
                                    <img src="\${imgUrl}" alt="Cover"/>
                                    <div class="card-title">\${title}</div>
                                    <div class="card-subtitle">\${subtitle}</div>
                                    \${btnQueue}
                                    <button class="btn-play">\${iconPlay}</button>
                                </div>
                            \`;
                        }).join('');

                        if (isAppend) content.innerHTML += html;
                        else content.innerHTML = html;
                    }

                    const spinnerHtml = \`
                        <div class="loading-container">
                            <div class="spinner"></div>
                            <div class="loading-text">Carregando...</div>
                        </div>
                    \`;

                    async function loadContent(type, query = '', isAppend = false) {
                        if (!isAppend) {
                            content.innerHTML = spinnerHtml;
                            currentOffset = 0;
                            currentLoadedType = type;
                            currentSearchQuery = query;
                            loadMoreContainer.style.display = 'none';
                        }

                        try {
                            const limit = 50;
                            const offsetParam = '&offset=' + currentOffset;
                            const offsetParamQuery = '?offset=' + currentOffset;

                            if (type === 'search') {
                                const data = await fetchSpotify('/search?q=' + encodeURIComponent(query) + '&type=track&limit=' + limit + offsetParam);
                                renderItems(data.tracks.items, 'tracks', isAppend);
                            } else if (type === 'playlists') {
                                const data = await fetchSpotify('/me/playlists?limit=' + limit + (currentOffset > 0 ? offsetParam : ''));
                                renderItems(data.items, 'playlists', isAppend);
                            } else if (type === 'liked') {
                                const data = await fetchSpotify('/me/tracks?limit=' + limit + (currentOffset > 0 ? offsetParam : ''));
                                const items = data.items.map(i => i.track);
                                renderItems(items, 'tracks', isAppend);
                            } else if (type === 'top') {
                                const data = await fetchSpotify('/me/top/tracks?limit=' + limit + '&time_range=short_term' + offsetParam);
                                renderItems(data.items, 'tracks', isAppend);
                            } else if (type === 'recent') {
                                if (isAppend) {
                                     loadMoreContainer.style.display = 'none';
                                     return;
                                }
                                const data = await fetchSpotify('/me/player/recently-played?limit=50');
                                const items = data.items.map(i => i.track);
                                const uniqueItems = items.filter((v,i,a)=>a.findIndex(t=>(t.id === v.id))===i);
                                renderItems(uniqueItems, 'tracks', isAppend);
                            } else if (type === 'queue') {
                                loadMoreContainer.style.display = 'none';
                                const data = await fetchSpotify('/me/player/queue');
                                const items = data.queue;
                                if (data.currently_playing) {
                                    content.innerHTML = '<div class="queue-title">Tocando agora</div>';
                                    content.innerHTML += renderSingleItem(data.currently_playing, 'tracks');
                                    content.innerHTML += '<div class="queue-title">Próximas na fila</div>';
                                    content.innerHTML += items.map(i => renderSingleItem(i, 'tracks')).join('');
                                } else {
                                    renderItems(items, 'queue', isAppend);
                                }
                            }
                        } catch (e) {
                            console.error(e);
                            content.innerHTML = '<div class="loading">Erro. Refaça a busca. (err: ' + e.message + ')</div>';
                        }
                    }

                    window.addEventListener('message', event => {
                        const message = event.data;
                        if (message.type === 'refresh') {
                            const activeTab = document.querySelector('.tab.active');
                            if (activeTab && activeTab.dataset.type === 'queue') {
                                loadContent('queue');
                            }
                        } else if (message.type === 'updateToken') {
                            token = message.token;
                        }
                    });

                    // auto refresh na fila
                    setInterval(() => {
                        const activeTab = document.querySelector('.tab.active');
                        if (activeTab && activeTab.dataset.type === 'queue') {
                            loadContent('queue');
                        }
                    }, REFRESH_INTERVAL);

                    tabs.forEach(tab => {
                        tab.addEventListener('click', () => {
                            tabs.forEach(t => t.classList.remove('active'));
                            tab.classList.add('active');
                            loadContent(tab.dataset.type);
                        });
                    });

                    window.play = function(uri) {
                        if (uri.includes('track') && currentUris.length > 0) {
                            vscode.postMessage({ type: 'play', uris: currentUris, offset: uri });
                        } else {
                            vscode.postMessage({ type: 'play', uri });
                        }
                     };

                     window.addToQueue = function(uri) {
                        vscode.postMessage({ type: 'addToQueue', uri });
                     };

                     function renderSingleItem(item, type) {
                        let imgUrl = '${logoUri}';
                        if (type === 'playlists' && item.images && item.images.length > 0) imgUrl = item.images[0].url;
                        if (type !== 'playlists' && item.album && item.album.images && item.album.images.length > 0) imgUrl = item.album.images[0].url;
                        
                        const title = item.name;
                        let subtitle = '';
                        if (type === 'playlists') subtitle = 'De ' + (item.owner?.display_name || 'Spotify');
                        else subtitle = (item.artists || []).map(a => a.name).join(', ');

                        const isTrack = type === 'tracks' || type === 'queue';
                        const btnQueue = isTrack ? \`<button class="btn-add-queue" onclick="event.stopPropagation(); addToQueue('\${item.uri}')">\${iconAddQueue}</button>\` : '';

                        return \`
                            <div class="card" onclick="play('\${item.uri}')">
                                <img src="\${imgUrl}" alt="Cover"/>
                                <div class="card-title">\${title}</div>
                                <div class="card-subtitle">\${subtitle}</div>
                                \${btnQueue}
                                <button class="btn-play">\${iconPlay}</button>
                            </div>
                        \`;
                     }

                    async function loadProfile() {
                        try {
                            const data = await fetchSpotify('/me');
                            if (data.images && data.images.length > 0) {
                                document.getElementById('userImg').src = data.images[0].url;
                                document.getElementById('userName').innerText = 'Logado como: ' + data.display_name;
                            }
                        } catch(e) { }
                    }

                    loadContent('liked');
                    loadProfile();
                </script>
            </body>
            </html>
        `;
    }
}
