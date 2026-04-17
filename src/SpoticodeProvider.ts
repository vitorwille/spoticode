import * as vscode from 'vscode';
import { FullscreenView } from './FullscreenView';
import { SpotifyAuth } from './SpotifyAuth';

export class SpoticodeProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private token?: string;
    private auth?: SpotifyAuth;

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
                        const states = ['track', 'context', 'off'];
                        const visualState = ['Repetir música', 'Repetir playlist', 'Desativar repetição'];
                        const pick = await vscode.window.showQuickPick(visualState, { placeHolder: 'Selecione o modo de repetição' });
                        if (pick) {
                            let stateIndex = visualState.indexOf(pick);
                            let finalState = states[stateIndex];
                            await this.spotifyFetch('https://api.spotify.com/v1/me/player/repeat?state=' + finalState, { method: 'PUT' });
                        }
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

                this._view.webview.postMessage({
                    type: 'update',
                    title,
                    artist,
                    image,
                    isPlaying
                });
            } else {
                this._view.webview.postMessage({
                    type: 'update',
                    title: 'Sem música tocando',
                    artist: 'Spoticode',
                    image: 'https://i.imgur.com/weLYqlw.png',
                    isPlaying: false
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
        const iconNext = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M12.7 1a.7.7 0 0 0-.7.7v5.15L2.05 1.107A.7.7 0 0 0 1 1.712v12.575a.7.7 0 0 0 1.05.607L12 9.149V14.3a.7.7 0 0 0 .7.7h1.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7h-1.6z"/></svg>`;
        const iconRepeat = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M0 4.75A3.75 3.75 0 0 1 3.75 1h8.5A3.75 3.75 0 0 1 16 4.75v5a3.75 3.75 0 0 1-3.75 3.75H9.81l1.018 1.018a.75.75 0 1 1-1.06 1.06L6.939 12.75l2.829-2.828a.75.75 0 1 1 1.06 1.06L9.811 12h2.439a2.25 2.25 0 0 0 2.25-2.25v-5a2.25 2.25 0 0 0-2.25-2.25h-8.5A2.25 2.25 0 0 0 1.5 4.75v5A2.25 2.25 0 0 0 3.75 12H5v1.5H3.75A3.75 3.75 0 0 1 0 9.75v-5z"/></svg>`;

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
                        margin-right: 30px;
                    }
                    .track-title {
                        font-size: 14px;
                        font-weight: bold;
                        white-space: nowrap;
                        text-overflow: ellipsis;
                        overflow: hidden;
                        line-height: 1.2;
                        margin-bottom: 4px;
                    }
                    .track-artist {
                        font-size: 12px;
                        color: #b3b3b3;
                        white-space: nowrap;
                        text-overflow: ellipsis;
                        overflow: hidden;
                    }
                    .check-icon {
                        position: absolute;
                        right: 0;
                        top: 50%;
                        transform: translateY(-50%);
                    }
                    .controls {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 0 4px;
                    }
                    .btn-icon {
                        background: none;
                        border: none;
                        color: #b3b3b3;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 0;
                    }
                    .btn-icon:hover {
                        color: #ffffff;
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
                    }
                    .btn-playpause:hover {
                        transform: scale(1.05);
                        color: #000000;
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
                        width: 95%;
                    }
                    .btn-action:hover {
                        transform: scale(1.04);
                        background: #1fdf64;
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
                    </div>
                    <div class="controls">
                        <button class="btn-icon" id="btnVol">${iconVolume}</button>
                        <button class="btn-icon" id="btnPrev">${iconPrev}</button>
                        <button class="btn-playpause" id="btnPlayPause">${isPlaying ? iconPause : iconPlay}</button>
                        <button class="btn-icon" id="btnNext">${iconNext}</button>
                        <button class="btn-icon" id="btnRep">${iconRepeat}</button>
                    </div>
                    <div id="volContainer" style="display: none; align-items: center; gap: 8px; margin-top: 8px; padding: 0 4px;">
                        <span style="font-size: 10px; color: #b3b3b3;">VOL</span>
                        <input type="range" id="volSlider" min="0" max="100" value="0" style="flex: 1; accent-color: #1ed760; cursor: pointer;">
                    </div>
                    ${this.token ? `
                    <div style="display: flex; justify-content: center; align-items: center;">
                        <button class="btn-action" id="btnFullscreen" style="margin-top: 12px;">Escolher Música/Playlist</button>
                    </div>
                    ` : ''}
                </div>
                <script>
                    const vscode = acquireVsCodeApi();
                    
                    const btnLogin = document.getElementById('btnLogin');
                    if(btnLogin) btnLogin.addEventListener('click', () => vscode.postMessage({ type: 'login' }));

                    const btnFullscreen = document.getElementById('btnFullscreen');
                    if(btnFullscreen) btnFullscreen.addEventListener('click', () => vscode.postMessage({ type: 'fullscreen' }));

                    document.getElementById('btnPlayPause').addEventListener('click', () => vscode.postMessage({ type: 'playpause' }));
                    document.getElementById('btnPrev').addEventListener('click', () => vscode.postMessage({ type: 'prev' }));
                    document.getElementById('btnNext').addEventListener('click', () => vscode.postMessage({ type: 'next' }));
                    
                    document.getElementById('btnVol')?.addEventListener('click', () => {
                        const vc = document.getElementById('volContainer');
                        if (vc) vc.style.display = vc.style.display === 'none' ? 'flex' : 'none';
                    });
                    
                    document.getElementById('volSlider')?.addEventListener('change', (e) => {
                        vscode.postMessage({ type: 'volume', value: e.target.value });
                    });

                    document.getElementById('btnRep')?.addEventListener('click', () => vscode.postMessage({ type: 'repeat' }));

                    window.addEventListener('message', event => {
                        const message = event.data;
                        if (message.type === 'update') {
                            document.getElementById('trackTitle').textContent = message.title;
                            document.getElementById('trackArtist').textContent = message.artist;
                            document.getElementById('albumArt').src = message.image;
                            document.getElementById('btnPlayPause').innerHTML = message.isPlaying ? '${iconPause}' : '${iconPlay}';
                        }
                    });
                </script>
            </body>
            </html>
        `;
    }
}
