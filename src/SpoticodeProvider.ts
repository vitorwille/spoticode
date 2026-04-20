import * as vscode from 'vscode';
import { FullscreenView } from './FullscreenView';
import { SpotifyAuth } from './SpotifyAuth';

export class SpoticodeProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private token?: string;
    private auth?: SpotifyAuth;
    private repeatState: string = 'off';

    constructor(private readonly _extensionUri: vscode.Uri) { }

    public setAuth(auth: SpotifyAuth) {
        this.auth = auth;
    }

    public setToken(token: string) {
        this.token = token;
        FullscreenView.updateTokenAll(token);
        if (this._view) {
            this._view.webview.html = this._getHtmlForWebview();
            this.updateWebview();
        }
    }

    public async resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        if (!this.token && this.auth) {
            await this.auth.checkExistingAuth();
        }

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview();

        // atualizar miniplayer caso usuario ja esteja logado
        if (this.token) {
            this.updateWebview();
        }

        webviewView.webview.onDidReceiveMessage(async (data: any) => {
            if (!this.token && data.type !== 'login') return;
            switch (data.type) {
                case 'playpause':
                    try {
                        const res = await this.spotifyFetch('https://api.spotify.com/v1/me/player');
                        if (!res) return;
                        const state: any = await res.json();

                        if (state && state.is_playing == true) {
                            await this.spotifyFetch('https://api.spotify.com/v1/me/player/pause', { method: 'PUT' });
                        } else {
                            await this.spotifyFetch('https://api.spotify.com/v1/me/player/play', { method: 'PUT' });
                        }
                        setTimeout(() => this.updateWebview(), 500);
                    } catch (e) {
                        console.error('Play/Pause error', e);
                    }
                    break;
                case 'next':
                    try {
                        await this.spotifyFetch('https://api.spotify.com/v1/me/player/next', { method: 'POST' });
                        setTimeout(() => this.updateWebview(), 500);
                    } catch (e) {
                        console.error('Next error', e);
                    }
                    break;
                case 'prev':
                    try {
                        await this.spotifyFetch('https://api.spotify.com/v1/me/player/previous', { method: 'POST' });
                        setTimeout(() => this.updateWebview(), 500);
                    } catch (e) {
                        console.error('Prev error', e);
                    }
                    break;
                case 'volume':
                    try {
                        let vol = data.value;
                        if (vol !== undefined) {
                            await this.spotifyFetch('https://api.spotify.com/v1/me/player/volume?volume_percent=' + vol, { method: 'PUT' });
                        }
                    } catch (e) {
                        console.error('Vol error', e);
                    }
                    break;
                case 'repeat':
                    try {
                        const nextStates: { [key: string]: string } = {
                            'off': 'context',
                            'context': 'track',
                            'track': 'off'
                        };
                        const nextState = nextStates[this.repeatState] || 'off';
                        await this.spotifyFetch('https://api.spotify.com/v1/me/player/repeat?state=' + nextState, { method: 'PUT' });
                        this.repeatState = nextState;
                        setTimeout(() => this.updateWebview(), 500);
                    } catch (e) {
                        console.error('Rep error', e);
                    }
                    break;
                case 'login':
                    vscode.commands.executeCommand('spoticode.login');
                    break;
                case 'fullscreen':
                    if (this.token) {
                        new FullscreenView(this.token!, this._extensionUri).show();
                    }
                    break;
            }
        });

        this.updateWebview();
        setInterval(() => this.updateWebview(), 7000);
    }

    private async spotifyFetch(url: string, options: any = {}): Promise<any> {
        if (!this.token) return null;

        let res = await fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': 'Bearer ' + this.token
            }
        });

        if (res.status === 401 && this.auth) {
            const newToken = await this.auth.refreshAccessToken();
            if (newToken) {
                res = await fetch(url, {
                    ...options,
                    headers: {
                        ...options.headers,
                        'Authorization': 'Bearer ' + newToken
                    }
                });
            }
        }
        return res;
    }

    private async updateWebview() {
        if (!this._view || !this.token) return;

        try {
            const res = await this.spotifyFetch('https://api.spotify.com/v1/me/player');
            if (!res) return;
            const data: any = await res.json();

            if (data && data.item) {
                const track = data.item;
                const title = track.name;
                const artist = track.artists.map((a: any) => a.name).join(', ');
                const image = track.album.images[0]?.url || '';
                const isPlaying = data.is_playing;
                this.repeatState = data.repeat_state;

                this._view.webview.postMessage({
                    type: 'update',
                    title,
                    artist,
                    image,
                    isPlaying,
                    repeatState: this.repeatState
                });
            } else {
                this._view.webview.postMessage({
                    type: 'update',
                    title: 'Sem música tocando',
                    artist: 'Spoticode',
                    image: 'https://i.imgur.com/weLYqlw.png',
                    isPlaying: false,
                    repeatState: 'off'
                });
            }
            FullscreenView.refreshAll();
        } catch (e) {
            console.error('Error fetching Spotify API', e);
        }
    }

    private _getHtmlForWebview(title = 'Faça login e/ou play no app', artist = 'Spoticode - github.com/vitorwille', image = 'https://i.imgur.com/weLYqlw.png', isPlaying = true) {
        const iconVolume = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
            <path d="M9.741.85a.75.75 0 0 1 .375.65v13a.75.75 0 0 1-1.125.65l-6.925-4a3.642 3.642 0 0 1-1.33-4.967 3.639 3.639 0 0 1 1.33-1.332l6.925-4a.75.75 0 0 1 .75 0zm-6.924 5.3a2.139 2.139 0 0 0 0 3.7l5.8 3.35V2.8l-5.8 3.35zm8.683 4.29V5.56a2.75 2.75 0 0 1 0 4.88z"/>
            <path d="M11.5 13.62a.75.75 0 1 1-1.06-1.06 4.39 4.39 0 0 0 0-6.12.75.75 0 1 1 1.06-1.06 5.89 5.89 0 0 1 0 8.24z"/>
        </svg>`;
        const iconPrev = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M3.3 1a.7.7 0 0 1 .7.7v5.15l9.95-5.744a.7.7 0 0 1 1.05.606v12.575a.7.7 0 0 1-1.05.607L4 9.149V14.3a.7.7 0 0 1-.7.7H1.7a.7.7 0 0 1-.7-.7V1.7a.7.7 0 0 1 .7-.7h1.6z"/></svg>`;
        const iconPlay = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288V1.713z"/></svg>`;
        const iconPause = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M2.7 1a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7H2.7zm8 0a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7h-2.6z"/></svg>`;
        const iconSearch = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M7 1.75a5.25 5.25 0 1 0 5.25 5.25A5.25 5.25 0 0 0 7 1.75zM.25 7a6.75 6.75 0 1 1 12.006 4.147l3.264 3.263a.75.75 0 1 1-1.06 1.06l-3.263-3.264A6.75 6.75 0 0 1 .25 7z"/></svg>`;
        const iconNext = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M12.7 1a.7.7 0 0 0-.7.7v5.15L2.05 1.107A.7.7 0 0 0 1 1.712v12.575a.7.7 0 0 0 1.05.607L12 9.149V14.3a.7.7 0 0 0 .7.7h1.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7h-1.6z"/></svg>`;
        const iconRepeat = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M0 4.75A3.75 3.75 0 0 1 3.75 1h8.5A3.75 3.75 0 0 1 16 4.75v5a3.75 3.75 0 0 1-3.75 3.75H9.81l1.018 1.018a.75.75 0 1 1-1.06 1.06L6.939 12.75l2.829-2.828a.75.75 0 1 1-1.06 1.06L9.811 12h2.439a2.25 2.25 0 0 0 2.25-2.25v-5a2.25 2.25 0 0 0-2.25-2.25h-8.5A2.25 2.25 0 0 0 1.5 4.75v5A2.25 2.25 0 0 0 3.75 12H5v1.5H3.75A3.75 3.75 0 0 1 0 9.75v-5z"/></svg>`;
        const iconRepeatAll = `<svg viewBox="0 0 16 18" width="16" height="18" fill="#1ed760"><path d="M0 4.75A3.75 3.75 0 0 1 3.75 1h8.5A3.75 3.75 0 0 1 16 4.75v5a3.75 3.75 0 0 1-3.75 3.75H9.81l1.018 1.018a.75.75 0 1 1-1.06 1.06L6.939 12.75l2.829-2.828a.75.75 0 1 1-1.06 1.06L9.811 12h2.439a2.25 2.25 0 0 0 2.25-2.25v-5a2.25 2.25 0 0 0-2.25-2.25h-8.5A2.25 2.25 0 0 0 1.5 4.75v5A2.25 2.25 0 0 0 3.75 12H5v1.5H3.75A3.75 3.75 0 0 1 0 9.75v-5z"/><circle cx="8" cy="17" r="1.5"/></svg>`;
        const iconRepeatOne = `<svg viewBox="0 0 16 18" width="16" height="18" fill="#1ed760"><path d="M0 4.75A3.75 3.75 0 0 1 3.75 1h8.5A3.75 3.75 0 0 1 16 4.75v5a3.75 3.75 0 0 1-3.75 3.75H9.81l1.018 1.018a.75.75 0 1 1-1.06 1.06L6.939 12.75l2.829-2.828a.75.75 0 1 1-1.06 1.06L9.811 12h2.439a2.25 2.25 0 0 0 2.25-2.25v-5a2.25 2.25 0 0 0-2.25-2.25h-8.5A2.25 2.25 0 0 0 1.5 4.75v5A2.25 2.25 0 0 0 3.75 12H5v1.5H3.75A3.75 3.75 0 0 1 0 9.75v-5z"/><path d="M7.75 4v5h1.5V4h-1.5zM7 5h1V4H7v1z"/><circle cx="8" cy="17" r="1.5"/></svg>`;

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <style>
                    body {
                        padding: 0;
                        margin: 0;
                        background-color: transparent;
                        color: #ffffff;
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        display: flex;
                        flex-direction: column;
                        overflow: hidden;
                    }
                    .miniplayer {
                        padding: 12px;
                        display: flex;
                        flex-direction: column;
                        gap: 12px;
                        border-radius: 8px;
                    }
                    .top-info {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        position: relative;
                        width: 100%;
                    }
                    .album-art {
                        width: 56px;
                        height: 56px;
                        border-radius: 4px;
                        background: #282828;
                        flex-shrink: 0;
                        object-fit: cover;
                    }
                    .track-info {
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        overflow: hidden;
                        flex: 1;
                        padding-right: 24px;
                    }
                    .track-title {
                        font-size: 14px;
                        font-weight: bold;
                        white-space: nowrap;
                        text-overflow: ellipsis;
                        overflow: hidden;
                        line-height: 1.2;
                        margin-bottom: 2px;
                    }
                    .track-artist {
                        font-size: 11px;
                        color: #b3b3b3;
                        white-space: nowrap;
                        text-overflow: ellipsis;
                        overflow: hidden;
                    }
                    .btn-open-small {
                        position: absolute;
                        right: 4px;
                        top: 14px;
                        opacity: 0.9;
                        transition: opacity 0.2s, transform 0.2s;
                    }
                    .btn-open-small:hover {
                        opacity: 1;
                    }
                    .controls {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 0px 4.75px;
                    }
                    .btn-icon {
                        background: none;
                        border: none;
                        color: #b3b3b3;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 4px;
                        transition: color 0.2s, transform 0.1s;
                        width: 32px;
                        height: 34px;
                        flex-shrink: 0;
                    }
                    .btn-icon:hover {
                        color: #ffffff;
                    }
                    .btn-icon:active {
                        transform: scale(0.9);
                    }
                    .btn-playpause {
                        background: #ffffff;
                        color: #000000;
                        border-radius: 50%;
                        width: 32px;
                        height: 32px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                        transition: transform 0.2s;
                        border: none;
                        cursor: pointer;
                    }
                    .btn-playpause:hover {
                        transform: scale(1.05);
                    }
                    .btn-playpause:active {
                        transform: scale(0.95);
                    }
                    .login-overlay {
                        position: absolute;
                        top: 0; left: 0; right: 0; bottom: 0;
                        background: rgba(0,0,0,0.8);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 10;
                    }
                    .btn-action {
                        background: #1ed760;
                        color: #000;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 20px;
                        font-weight: bold;
                        cursor: pointer;
                        text-align: center;
                        width: 100%;
                        transition: all 0.2s ease;
                        font-size: 13px;
                    }
                    .btn-action:hover {
                        transform: scale(1.02);
                        background: #1fdf64;
                    }
                    
                    /* Responsive adjustments */
                    @media (max-width: 250px) {
                        .miniplayer { padding: 8px; gap: 8px; }
                        .album-art { width: 44px; height: 44px; }
                        .track-title { font-size: 13px; }
                        .track-artist { font-size: 10px; }
                    }
                    
                    @media (max-width: 180px) {
                        .top-info { flex-direction: column; align-items: center; text-align: center; gap: 8px; }
                        .track-info { margin-right: 0; width: 100%; padding-right: 0; }
                        .album-art { width: 80%; height: auto; aspect-ratio: 1; }
                        .controls { justify-content: center; gap: 8px; flex-wrap: wrap; }
                        .btn-open-small { top: 0; right: 10%; }
                    }
                </style>
            </head>
            <body>
                <div class="miniplayer">
                    ${!this.token ? `
                    <div class="login-overlay" style="display: flex; justify-content: center; align-items: center;">
                        <button class="btn-action" id="btnLogin">Logar no Spotify</button>
                    </div>
                    ` : ''}
                    <div class="top-info">
                        <img id="albumArt" src="${image}" class="album-art"/>
                        <div class="track-info">
                            <div id="trackTitle" class="track-title">${title}</div>
                            <div id="trackArtist" class="track-artist">${artist}</div>
                        </div>
                        <button class="btn-icon btn-open-small" id="btnOpenSmall" title="Escolher Música">${iconSearch}</button>
                    </div>
                    <div class="controls" style="min-height: 32px;">
                        <button class="btn-icon" id="btnVol">${iconVolume}</button>
                        
                        <button class="btn-icon pb-btn" id="btnPrev">${iconPrev}</button>
                        <button class="btn-playpause pb-btn" id="btnPlayPause">${isPlaying ? iconPause : iconPlay}</button>
                        <button class="btn-icon pb-btn" id="btnNext">${iconNext}</button>
                        <button class="btn-icon pb-btn" id="btnRep">${iconRepeat}</button>

                        <div id="volContainer" style="display: none; flex: 1; align-items: center; gap: 8px; margin-left: 8px; height: 32px;">
                            <input type="range" id="volSlider" min="0" max="100" value="0" style="flex: 1; accent-color: #1ed760; cursor: pointer; margin: 0;">
                        </div>
                    </div>
                </div>
                <script>
                    const vscode = acquireVsCodeApi();
                    
                    const btnLogin = document.getElementById('btnLogin');
                    if(btnLogin) btnLogin.addEventListener('click', () => vscode.postMessage({ type: 'login' }));

                    const btnOpenSmall = document.getElementById('btnOpenSmall');
                    if(btnOpenSmall) btnOpenSmall.addEventListener('click', () => vscode.postMessage({ type: 'fullscreen' }));

                    document.getElementById('btnPlayPause').addEventListener('click', () => vscode.postMessage({ type: 'playpause' }));
                    document.getElementById('btnPrev').addEventListener('click', () => vscode.postMessage({ type: 'prev' }));
                    document.getElementById('btnNext').addEventListener('click', () => vscode.postMessage({ type: 'next' }));
                    
                    document.getElementById('btnVol')?.addEventListener('click', () => {
                        const pbBtns = document.querySelectorAll('.pb-btn');
                        const vc = document.getElementById('volContainer');
                        const controls = document.querySelector('.controls');
                        if (vc && controls) {
                            const isShowingVol = vc.style.display === 'flex';
                            vc.style.display = isShowingVol ? 'none' : 'flex';
                            pbBtns.forEach(btn => btn.style.display = isShowingVol ? 'flex' : 'none');
                            controls.style.justifyContent = isShowingVol ? 'space-between' : 'flex-start';
                        }
                    });
                    
                    document.getElementById('volSlider')?.addEventListener('change', (e) => {
                        vscode.postMessage({ type: 'volume', value: e.target.value });
                    });

                    document.getElementById('btnRep')?.addEventListener('click', () => vscode.postMessage({ type: 'repeat' }));

                    window.addEventListener('message', event => {
                        const message = event.data;
                        if (message.type === 'update') {
                            console.log('Update received:', message.repeatState);
                            document.getElementById('trackTitle').textContent = message.title;
                            document.getElementById('trackArtist').textContent = message.artist;
                            document.getElementById('albumArt').src = message.image;
                            document.getElementById('btnPlayPause').innerHTML = message.isPlaying ? '${iconPause}' : '${iconPlay}';
                            
                            const btnRep = document.getElementById('btnRep');
                            if (btnRep) {
                                if (message.repeatState === 'track') {
                                    btnRep.innerHTML = '${iconRepeatOne}';
                                } else if (message.repeatState === 'context') {
                                    btnRep.innerHTML = '${iconRepeatAll}';
                                } else {
                                    btnRep.innerHTML = '${iconRepeat}';
                                }
                            }
                        }
                    });
                </script>
            </body>
            </html>
        `;
    }
}
