import * as vscode from 'vscode';
import express from 'express';
import cors from 'cors';
import { randomBytes, createHash } from 'crypto';
import { SpoticodeProvider } from './SpoticodeProvider';

export class SpotifyAuth {
    private server: any;
    private provider: SpoticodeProvider;
    private context: vscode.ExtensionContext;
    private clientId: string = '';
    private codeVerifier: string = '';

    constructor(provider: SpoticodeProvider, context: vscode.ExtensionContext) {
        this.provider = provider;
        this.context = context;
    }

    private base64urlencode(buffer: Buffer): string {
        return buffer.toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }

    private generateCodeVerifier(): string {
        return this.base64urlencode(randomBytes(32));
    }

    private generateCodeChallenge(verifier: string): string {
        const hash = createHash('sha256').update(verifier).digest();
        return this.base64urlencode(hash);
    }

    public async checkExistingAuth() {
        const refreshToken = await this.context.secrets.get('spoticodeRefreshToken');
        const accessToken = await this.context.secrets.get('spoticodeAccessToken');

        if (refreshToken) {
            const success = await this.refreshAccessToken();
            if (!success && accessToken) {
                this.provider.setToken(accessToken);
            }
        } else if (accessToken) {
            this.provider.setToken(accessToken);
        }
    }

    public async refreshAccessToken(): Promise<boolean> {
        const refreshToken = await this.context.secrets.get('spoticodeRefreshToken');
        const config = vscode.workspace.getConfiguration('spoticode');
        this.clientId = config.get<string>('clientId') || '';

        if (!refreshToken || !this.clientId) return false;

        try {
            const params = new URLSearchParams();
            params.append('client_id', this.clientId);
            params.append('grant_type', 'refresh_token');
            params.append('refresh_token', refreshToken);

            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString()
            });

            if (!response.ok) return false;

            const data: any = await response.json();
            if (data.access_token) {
                await this.context.secrets.store('spoticodeAccessToken', data.access_token);
                if (data.refresh_token) {
                    await this.context.secrets.store('spoticodeRefreshToken', data.refresh_token);
                }
                this.provider.setToken(data.access_token);
                return true;
            }
        } catch (error) {
            console.error('Refresh token error:', error);
        }
        return false;
    }

    public async startAuth() {
        const config = vscode.workspace.getConfiguration('spoticode');
        this.clientId = config.get<string>('clientId') || '';

        if (!this.clientId) {
            const input = await vscode.window.showInputBox({
                prompt: "Digite o Client ID do Spotify",
                placeHolder: "Obtenha em developer.spotify.com/dashboard",
                ignoreFocusOut: true
            });
            if (!input) return;
            this.clientId = input.trim();
            await config.update('clientId', this.clientId, vscode.ConfigurationTarget.Global);
        }

        const port = 8888;
        const redirectUri = `http://[::1]:${port}/callback`;
        this.codeVerifier = this.generateCodeVerifier();
        const codeChallenge = this.generateCodeChallenge(this.codeVerifier);

        const state = randomBytes(16).toString('hex');
        const scope = 'user-read-playback-state user-modify-playback-state playlist-read-private playlist-read-collaborative user-library-read user-top-read user-read-recently-played';

        if (this.server) {
            this.server.close();
        }

        const app = express();
        app.use(cors());

        app.get('/callback', async (req: express.Request, res: express.Response) => {
            const code = req.query.code as string;

            try {
                const params = new URLSearchParams();
                params.append('client_id', this.clientId);
                params.append('grant_type', 'authorization_code');
                params.append('code', code);
                params.append('redirect_uri', redirectUri);
                params.append('code_verifier', this.codeVerifier);

                const response = await fetch('https://accounts.spotify.com/api/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params.toString()
                });

                const data: any = await response.json();
                const token = data.access_token;
                const refreshToken = data.refresh_token;

                if (token) {
                    await this.context.secrets.store('spoticodeAccessToken', token);
                    if (refreshToken) {
                        await this.context.secrets.store('spoticodeRefreshToken', refreshToken);
                    }

                    this.provider.setToken(token);
                    vscode.window.showInformationMessage("Spoticode autorizado com sucesso!");
                    res.send('<h1>Autorizado! Pode fechar esta aba.</h1>');

                    if (this.server) {
                        this.server.close();
                        this.server = null;
                    }
                } else {
                    res.status(400).send('<h1>Erro no token. Verifique o Client ID.</h1>');
                }
            } catch (error: any) {
                res.status(500).send('<h1>Erro interno na troca de tokens.</h1>');
            }
        });

        this.server = app.listen(port, () => {
            const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${this.clientId}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&code_challenge_method=S256&code_challenge=${codeChallenge}`;
            vscode.env.openExternal(vscode.Uri.parse(authUrl));
        });
    }
}
