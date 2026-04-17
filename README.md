# Spoticode - Spotify dentro do VSCode

<img alt="Spoticode logo" src="https://i.imgur.com/Mu1Djy0.png" style="display: block; margin: auto auto 15px auto;">
<br>
<sub style="display: block; margin: auto auto 15px auto; text-align: center; font-size: 10px;">obrigado gemini pelo logo muito profissional 👍</sub>
<br>

O Spoticode é uma extensão para VSCode que integra um miniplayer do Spotify diretamente no seu editor, permitindo controlar suas músicas e buscar novas faixas sem sair da sua área de trabalho.

Meio nichado, né? Pois é, foi criado por pura preguiça de dar Alt+Tab. A preguiça move o mundo em muitos aspectos, a depender do ponto de vista 👍

## ⚠️ Requisitos essenciais

- **Spotify Premium**: O controle via API é uma feature exclusiva para assinantes do Spotify Premium.

- **App Spotify Aberto**: Você precisa ter o Spotify (Desktop ou Web) aberto em algum dispositivo para que a extensão consiga enviar os comandos de reprodução. A reprodução deve ser iniciada primeiro pelo app/site do Spotify para que a extensão possa controlar.

## 🚀 Como configurar

### 1. Obter seu Spotify Client ID

Para usar a extensão, você precisa criar uma Application no Spotify Developer Dashboard:

1. Acesse o [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Clique em "**Create app**".
3. Dê um nome (ex: Spoticode) e descrição.
4. No campo "**Redirect URIs**", adicione exatamente este link: `http://[::1]:8888/callback`. Caso ele esteja incorreto, a extensão não funcionará.
5. Salve as alterações.
6. Copie o seu **Client ID**.

### 2. Primeiro Acesso

1. No VSCode, abra a aba do Spoticode nos painéis inferiores da sua aba lateral.
2. Clique em "**Logar no Spotify**".
3. Quando solicitado, cole o seu **Client ID**.
4. Uma janela do navegador será aberta para você autorizar o acesso.
5. Após a mensagem de sucesso, você pode fechar o navegador e voltar para o VSCode.

## 🎧 Features

### Miniplayer (painel inferior)

- **Controles**: Play/Pause, Próxima, Anterior.
- **Volume**: Clique no ícone de volume e use o slider para ajustar.
- **Repetir**: Clique no ícone de repetir e escolha entre música, playlist ou desativado.

### Tela Fullscreen (Escolher Música/Playlist)

- **Busca**: Barra de busca funcional para encontrar qualquer música no Spotify.
- **Músicas Curtidas**: Acesse suas músicas salvas rapidamente.
- **Playlists**: Veja e reproduza suas playlists pessoais.
- **Mais Tocadas**: Veja o que você mais ouviu recentemente.
- **Reprodução Inteligente**: Clique em "Ouvir Lista" para iniciar uma rádio baseada na aba selecionada, ou clique em uma música para tocar ela.

## 🎨 Preview

<img alt="Spoticode - Miniplayer" src="https://i.imgur.com/8l0FQaI.png" style="display: block; margin: auto auto 15px auto">
<img alt="Spoticode - Tela Fullscreen" src="https://i.imgur.com/I91FgtZ.png" style="display: block; margin: 15px 15px auto auto; width: 100%;">

## ❓ FAQ

### Dei play na música pelo app do Spotify e o Spoticode não atualizou o miniplayer. Por quê?

Por questões de performance, a extensão não atualiza o miniplayer automaticamente. Você precisa realizar alguma ação no miniplayer para que ele atualize. Entretanto, se a música já estiver tocando quando o VS Code for aberto, ele deve atualizar de maneira automática.

### Não era mais fácil dar Alt+Tab e usar o Spotify?

Sim, com toda certeza 👍
