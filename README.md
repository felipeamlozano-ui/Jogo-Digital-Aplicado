# Educação Física Digital — Vitalis GO

Jogo mobile-first em formato PWA inspirado em Pokémon GO para incentivar a prática de **Educação Física** no mundo real. Explore o mapa, encontre criaturas **Vitalis** próximas e realize exercícios físicos (polichinelos, agachamentos, corrida/caminhada e prancha) para capturá-las, ganhar XP, subir de nível e desbloquear conquistas.

## Tecnologias

- **Backend:** Python 3.12 (somente biblioteca padrão: `http.server`, `sqlite3`, `json`, `math`, `random`, `pathlib`, `urllib`) — **zero dependências externas (`pip install` não é necessário)**.
- **Banco de Dados:** SQLite (`vitalis.db` criado automaticamente na primeira execução).
- **Frontend:** HTML5, CSS3, JavaScript (ES6+), Leaflet + OpenStreetMap, Web Audio API, DeviceMotion API, Geolocation API e Camera API (AR Lite).

## Como Executar

1. Certifique-se de ter **Python 3.12+** instalado:
   ```bash
   python --version
   ```
2. Na raiz do projeto, inicie o servidor:
   ```bash
   python app.py
   ```
3. Abra o navegador em:
   ```text
   http://localhost:8000
   ```

> **Dica para testes no PC:** Use o botão **Simulador** no topo da tela para se movimentar pelo mapa com o joystick virtual ou teclado (`WASD` / Setas) e testar capturas com o botão de ritmo manual.

## Notas sobre GPS e Câmera no Celular

Navegadores móveis (Chrome/Safari) exigem um **contexto seguro (HTTPS)** para liberar `navigator.geolocation` (GPS real) e `navigator.mediaDevices.getUserMedia` (Câmera AR Lite) quando o site é acessado por um endereço diferente de `localhost`:

- **No mesmo computador:** `http://localhost:8000` funciona normalmente sem HTTPS.
- **No celular na mesma rede Wi-Fi:** exponha a porta `8000` usando um túnel HTTPS (como `ngrok http 8000` ou `cloudflared tunnel --url http://localhost:8000`) e acesse a URL `https://...` gerada no seu smartphone.
- Caso a câmera não esteja disponível ou a permissão seja negada, o modo **AR Lite** ativa automaticamente uma animação SVG da criatura.

## API REST

- `GET /api/player` — Perfil do atleta, nível, XP, calorias, distância e medalhas.
- `GET /api/spawns?lat=<float>&lng=<float>` — Criaturas Vitalis próximas às coordenadas informadas.
- `POST /api/capture` — Registra exercício e captura (`{creature_id, exercise_type, duration_sec, distance_m, reps}`).
- `GET /api/fitdex` — Catálogo completo das criaturas Vitalis com contagem de capturas.
- `GET /api/missions` — Missões ativas e progresso em tempo real.
- `GET /api/leaderboard` — Ranking de atletas por nível e XP.

## Jogar Online (GitHub Pages)

O jogo também está disponível em versão 100% estática (com motor local via `localStorage` quando não há backend Python) no GitHub Pages:

- **URL:** https://felipeamlozano-ui.github.io/Jogo-Digital-Aplicado/

## Publicação no GitHub (`Jogo-Digital-Aplicado`)

Para subir este projeto para o repositório GitHub e publicar automaticamente no GitHub Pages (via `.github/workflows/pages.yml`):

```bash
git init
git add .
git commit -m "feat: implementa Educacao Fisica Digital (Vitalis GO)"
git branch -M main
git remote add origin https://github.com/felipeamlozano-ui/Jogo-Digital-Aplicado.git
git push -u origin main
```
