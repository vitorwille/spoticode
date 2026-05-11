import * as vscode from 'vscode';
import { SpoticodeProvider } from './SpoticodeProvider';
import { SpotifyAuth } from './SpotifyAuth';

export function activate(context: vscode.ExtensionContext) {
    console.log('[ok] Spoticode iniciado!');

    const version = context.extension.packageJSON.version;
    const provider = new SpoticodeProvider(context.extensionUri, version);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider("spoticode.miniplayer", provider)
    );

    const auth = new SpotifyAuth(provider, context);
    provider.setAuth(auth);

    context.subscriptions.push(
        vscode.commands.registerCommand('spoticode.login', () => {
            auth.startAuth();
        })
    );

    auth.checkExistingAuth();
}

export function deactivate() { }
