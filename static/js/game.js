(function (global) {
  'use strict';

  const { SoundFX, LocationManager, ExerciseTracker, CameraAR } = global.VitalisSensors;
  const Icons = global.VitalisIcons;

  const TYPE_COLORS = {
    Cardio: '#E11D48',
    Força: '#D97706',
    Agilidade: '#0284C7',
    Equilíbrio: '#7C3AED'
  };

  function createCreatureSVG(creature) {
    const color = creature.svg_color || TYPE_COLORS[creature.type] || '#10b981';
    const uid = String(creature.creature_id || creature.id || 'v').replace(/[^a-zA-Z0-9_-]/g, '');
    const iconKey =
      creature.icon ||
      (Icons && Icons.TYPE_ICON_MAP[creature.type]) ||
      'bolt';
    const innerIcon = Icons ? Icons.get(iconKey, 24) : '';

    return `
      <div class="creature-vector-badge" style="--creature-color: ${color};">
        <svg viewBox="0 0 120 120" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <radialGradient id="grad-${uid}" cx="35%" cy="30%" r="72%">
              <stop offset="0%" stop-color="#ffffff" stop-opacity="0.38"/>
              <stop offset="55%" stop-color="${color}" stop-opacity="0.96"/>
              <stop offset="100%" stop-color="#0f172a" stop-opacity="0.98"/>
            </radialGradient>
          </defs>
          <circle cx="60" cy="60" r="50" fill="none" stroke="${color}" stroke-opacity="0.35" stroke-width="2" stroke-dasharray="6 4"/>
          <circle cx="60" cy="60" r="42" fill="url(#grad-${uid})" stroke="#ffffff" stroke-opacity="0.45" stroke-width="2.5"/>
          <circle cx="46" cy="54" r="5" fill="#ffffff"/>
          <circle cx="74" cy="54" r="5" fill="#ffffff"/>
          <circle cx="47" cy="54" r="2.4" fill="#0f172a"/>
          <circle cx="75" cy="54" r="2.4" fill="#0f172a"/>
          <path d="M48 70 Q60 79 72 70" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
        </svg>
        <div class="creature-type-emblem" style="background:${color};">
          ${innerIcon}
        </div>
      </div>
    `;
  }

  function formatDistance(meters) {
    const m = Math.round(meters || 0);
    if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
    return `${m} m`;
  }

  function showToast(msg, durationMs = 2800) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => {
      el.remove();
    }, durationMs);
  }

  class GameApp {
    constructor() {
      this.player = null;
      this.spawns = [];
      this.activeTab = 'map';
      this.currentEncounter = null;
      this.tracker = null;
      this.arActive = false;
      this.sessionDistanceSinceSpawnFetch = 0;
      this.pendingSessionDistance = 0;
      this.useLocalEngine = global.location.hostname.endsWith('github.io');

      this.location = new LocationManager({
        initialMode: 'gps',
        onMove: (lat, lng, deltaM, isFirstFix) => this.handlePlayerMove(lat, lng, deltaM, isFirstFix),
        onModeChange: (mode) => this.updateModeUI(mode),
        onGPSState: (state, msg) => this.handleGPSState(state, msg),
        onError: (msg) => showToast(msg, 3500)
      });

      this.vitalisMap = new global.VitalisMap({
        containerId: 'map',
        onSpawnClick: (spawn) => this.openEncounter(spawn),
        onOutOfRange: (spawn, dist) => {
          const remaining = Math.max(1, Math.round(dist - global.INTERACTION_RADIUS_M));
          showToast(`${spawn.name} está a ${Math.round(dist)} m. Aproxime-se mais ${remaining} m.`);
        }
      });
    }

    async init() {
      this._registerSW();
      this._bindEvents();
      this.updateModeUI(this.location.mode);

      await this.fetchPlayer();
      // Immediately request real GPS permission on load (never silent fake location)
      this.location.requestGPS();
    }

    _registerSW() {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
      }
    }

    handleGPSState(state, message) {
      const overlay = document.getElementById('location-overlay');
      const title = document.getElementById('location-overlay-title');
      const msgEl = document.getElementById('location-overlay-msg');
      const retryBtn = document.getElementById('btn-retry-gps');

      if (!overlay) return;

      if (state === 'ready') {
        overlay.classList.add('hidden');
        return;
      }

      overlay.classList.remove('hidden');
      if (state === 'requesting') {
        title.textContent = 'Localização GPS';
        msgEl.textContent = message || 'Solicitando acesso à sua localização...';
        retryBtn.textContent = 'Ativar localização';
      } else if (state === 'error') {
        title.textContent = 'GPS Indisponível';
        msgEl.textContent = message || 'Não foi possível acessar sua localização.';
        retryBtn.textContent = 'Tentar novamente';
      }
    }

    _localDispatchGet(url) {
      const eng = global.LocalGameEngine;
      if (!eng) throw new Error('LocalGameEngine indisponível');
      if (url.includes('/api/player')) return eng.getPlayer();
      if (url.includes('/api/spawns')) {
        const q = url.split('?')[1] || '';
        const params = new URLSearchParams(q);
        return eng.getSpawns(params.get('lat'), params.get('lng'));
      }
      if (url.includes('/api/fitdex')) return eng.getFitdex();
      if (url.includes('/api/missions')) return eng.getMissions();
      if (url.includes('/api/leaderboard')) return eng.getLeaderboard();
      throw new Error(`Endpoint local desconhecido: ${url}`);
    }

    _localDispatchPost(url, body) {
      const eng = global.LocalGameEngine;
      if (!eng) throw new Error('LocalGameEngine indisponível');
      if (url.includes('/api/capture')) return eng.postCapture(body);
      throw new Error(`Endpoint POST local desconhecido: ${url}`);
    }

    async apiGet(url) {
      if (this.useLocalEngine && global.LocalGameEngine) {
        return this._localDispatchGet(url);
      }
      try {
        const res = await fetch(url);
        const ct = res.headers.get('content-type') || '';
        if (!res.ok || !ct.includes('application/json')) {
          throw new Error(`HTTP ${res.status}`);
        }
        return await res.json();
      } catch (err) {
        if (global.LocalGameEngine) {
          this.useLocalEngine = true;
          return this._localDispatchGet(url);
        }
        throw err;
      }
    }

    async apiPost(url, body) {
      if (this.useLocalEngine && global.LocalGameEngine) {
        return this._localDispatchPost(url, body);
      }
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const ct = res.headers.get('content-type') || '';
        if (!res.ok || !ct.includes('application/json')) {
          throw new Error(`HTTP ${res.status}`);
        }
        return await res.json();
      } catch (err) {
        if (global.LocalGameEngine) {
          this.useLocalEngine = true;
          return this._localDispatchPost(url, body);
        }
        throw err;
      }
    }

    async fetchPlayer() {
      try {
        this.player = await this.apiGet('./api/player');
        this.renderHUD();
      } catch (_) {
        showToast('Erro ao carregar dados do atleta.');
      }
    }

    async fetchSpawns() {
      if (this.location.lat === null || this.location.lng === null) return;
      try {
        const data = await this.apiGet(
          `./api/spawns?lat=${this.location.lat.toFixed(6)}&lng=${this.location.lng.toFixed(6)}`
        );
        this.spawns = data.spawns || [];
        this.vitalisMap.setSpawns(this.spawns);
      } catch (_) {
        showToast('Erro ao buscar Vitalis próximos.');
      }
    }

    handlePlayerMove(lat, lng, deltaM, isFirstFix) {
      if (!this.vitalisMap.initialized) {
        this.vitalisMap.init(lat, lng);
      } else {
        this.vitalisMap.updatePlayerPosition(lat, lng, true);
      }

      if (isFirstFix) {
        this.fetchSpawns();
        return;
      }

      this.pendingSessionDistance += deltaM;
      this.sessionDistanceSinceSpawnFetch += deltaM;

      if (this.sessionDistanceSinceSpawnFetch >= 60) {
        this.sessionDistanceSinceSpawnFetch = 0;
        this.fetchSpawns();
      }
    }

    updateModeUI(mode) {
      const btn = document.getElementById('btn-mode-toggle');
      const label = document.getElementById('mode-label');
      const simPad = document.getElementById('simulator-controls');

      if (mode === 'gps') {
        btn.classList.remove('mode-sim');
        btn.classList.add('mode-gps');
        label.textContent = 'GPS Real';
        simPad.classList.add('hidden');
      } else {
        btn.classList.remove('mode-gps');
        btn.classList.add('mode-sim');
        label.textContent = 'Simulador';
        simPad.classList.remove('hidden');
      }
    }

    renderHUD() {
      if (!this.player) return;
      document.getElementById('hud-level').textContent = this.player.level ?? 1;
      document.getElementById('hud-username').textContent = this.player.username || 'Atleta';

      const xp = this.player.xp ?? 0;
      const nextXp = this.player.next_level_xp || 100;
      const pct = Math.min(100, Math.round((xp / nextXp) * 100));

      document.getElementById('hud-xp-text').textContent = `${xp} / ${nextXp} XP`;
      document.getElementById('hud-xp-fill').style.width = `${pct}%`;
      document.getElementById('hud-calories').textContent = `${Math.round(this.player.total_calories || 0)} kcal`;
      document.getElementById('hud-distance').textContent = formatDistance(this.player.total_distance_m || 0);
    }

    async switchTab(tab) {
      this.activeTab = tab;
      document.querySelectorAll('.nav-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.tab === tab);
      });
      document.querySelectorAll('.view').forEach((v) => {
        v.classList.toggle('active', v.id === `view-${tab}`);
      });

      if (tab === 'map') {
        this.vitalisMap.invalidateSize();
      } else if (tab === 'fitdex') {
        await this.loadFitDex();
      } else if (tab === 'missions') {
        await this.loadMissions();
      } else if (tab === 'profile') {
        await this.loadProfileAndLeaderboard();
      }
    }

    async loadFitDex() {
      const grid = document.getElementById('fitdex-grid');
      const summary = document.getElementById('fitdex-summary');
      grid.innerHTML = '<p class="view-subtitle">Carregando FitDex...</p>';
      try {
        const data = await this.apiGet('./api/fitdex');
        const creatures = data.creatures || [];
        const capturedTotal = creatures.filter((c) => (c.captured_count || 0) > 0).length;
        summary.textContent = `${capturedTotal} de ${creatures.length} Vitalis registrados`;

        grid.innerHTML = creatures
          .map((c) => {
            const unlocked = (c.captured_count || 0) > 0;
            return `
              <div class="fitdex-card ${unlocked ? '' : 'locked'}">
                <div class="creature-art-wrap">${createCreatureSVG(c)}</div>
                <div class="fitdex-name">${unlocked ? c.name : 'Não descoberto'}</div>
                <div class="fitdex-meta">${c.type} • ${c.exercise_type}</div>
                <div class="fitdex-count">
                  ${unlocked ? `Capturas: ${c.captured_count}` : 'Bloqueado'}
                </div>
              </div>
            `;
          })
          .join('');
      } catch (_) {
        grid.innerHTML = '<p class="error-text">Erro ao carregar FitDex.</p>';
      }
    }

    async loadMissions() {
      const list = document.getElementById('missions-list');
      list.innerHTML = '<p class="view-subtitle">Carregando missões...</p>';
      try {
        const data = await this.apiGet('./api/missions');
        const missions = data.missions || [];
        const checkSvg = Icons ? Icons.get('check', 15, 'mission-check-icon') : '';
        list.innerHTML = missions
          .map((m) => {
            const pct = Math.min(100, Math.round(((m.progress || 0) / (m.target || 1)) * 100));
            return `
              <div class="mission-card ${m.completed ? 'completed' : ''}">
                <div class="mission-top">
                  <div class="mission-title">
                    ${m.completed ? checkSvg : ''}
                    <span>${m.title}</span>
                  </div>
                  <div class="mission-xp">+${m.xp_reward} XP</div>
                </div>
                <div class="mission-desc">${m.description}</div>
                <div class="mission-progress-row">
                  <span>Progresso: ${m.progress} / ${m.target} ${m.unit || ''}</span>
                  <span>${pct}%</span>
                </div>
                <div class="xp-bar">
                  <div class="xp-fill" style="width: ${pct}%;"></div>
                </div>
              </div>
            `;
          })
          .join('');
      } catch (_) {
        list.innerHTML = '<p class="error-text">Erro ao carregar missões.</p>';
      }
    }

    async loadProfileAndLeaderboard() {
      try {
        const [player, lbData] = await Promise.all([
          this.apiGet('./api/player'),
          this.apiGet('./api/leaderboard')
        ]);
        this.player = player;
        this.renderHUD();

        document.getElementById('profile-username').textContent = player.username || 'Atleta';
        document.getElementById('profile-level-info').textContent = `Nível ${player.level} • ${player.xp} XP`;
        document.getElementById('profile-exercises').textContent = player.total_exercises || 0;
        document.getElementById('profile-distance').textContent = formatDistance(player.total_distance_m || 0);
        document.getElementById('profile-calories').textContent = Math.round(player.total_calories || 0);

        const badgesEl = document.getElementById('profile-badges');
        const badges = Array.isArray(player.badges) ? player.badges : [];
        badgesEl.innerHTML = badges.length
          ? badges
              .map((b) => {
                if (typeof b === 'string') {
                  const svg = Icons ? Icons.get('award', 13) : '';
                  return `<span class="badge-chip">${svg}<span>${b}</span></span>`;
                }
                const svg = Icons ? Icons.get(b.icon || 'award', 13) : '';
                return `<span class="badge-chip" title="${b.description || ''}">${svg}<span>${b.name || b.id}</span></span>`;
              })
              .join('')
          : '<span class="view-subtitle">Complete treinos para desbloquear conquistas.</span>';

        const lbList = document.getElementById('leaderboard-list');
        const rows = lbData.leaderboard || [];
        lbList.innerHTML = rows
          .map((row) => {
            const isMe = row.username === player.username;
            return `
              <div class="leader-row ${isMe ? 'is-me' : ''}">
                <div class="leader-left">
                  <div class="leader-rank">#${row.rank}</div>
                  <div>
                    <div class="leader-name">${row.username} ${isMe ? '(Você)' : ''}</div>
                    <div class="leader-sub">Nível ${row.level} • ${row.total_exercises} exercícios</div>
                  </div>
                </div>
                <div class="leader-xp">${row.xp} XP</div>
              </div>
            `;
          })
          .join('');
      } catch (_) {
        showToast('Erro ao carregar perfil e ranking.');
      }
    }

    // --- Encounter & Challenge Modal ---
    openEncounter(spawn) {
      this.currentEncounter = spawn;
      this.arActive = false;

      document.getElementById('enc-name').textContent = spawn.name;
      document.getElementById('enc-desc').textContent =
        spawn.description || `Complete o desafio de ${spawn.exercise_type} para capturar ${spawn.name}.`;
      document.getElementById('enc-type').textContent = spawn.type || 'Vitalis';
      document.getElementById('enc-rarity').textContent = spawn.rarity || 'Comum';
      document.getElementById('enc-exercise').textContent = spawn.exercise_type;
      document.getElementById('enc-xp').textContent = `+${spawn.xp_reward} XP`;

      document.getElementById('creature-svg-container').innerHTML = createCreatureSVG(spawn);

      const unitLabel = spawn.unit || 'reps';
      document.getElementById('challenge-progress-text').textContent = `0 / ${spawn.target} ${unitLabel}`;
      document.getElementById('challenge-timer').textContent = '0s';
      document.getElementById('challenge-progress-fill').style.width = '0%';
      document.getElementById('motion-indicator').textContent =
        'Pronto para iniciar. Use o sensor do celular ou o botão de ritmo.';

      document.getElementById('btn-start-challenge').classList.remove('hidden');
      document.getElementById('btn-manual-rep').classList.add('hidden');
      document.getElementById('challenge-body').classList.remove('hidden');
      document.getElementById('capture-celebration').classList.add('hidden');
      const arLabel = document.querySelector('#btn-toggle-ar span');
      if (arLabel) arLabel.textContent = 'Ativar Câmera AR';

      document.getElementById('encounter-modal').classList.remove('hidden');
    }

    closeEncounter() {
      if (this.tracker) {
        this.tracker.stop();
        this.tracker = null;
      }
      if (this.arActive) {
        CameraAR.stop(document.getElementById('ar-video'));
        this.arActive = false;
      }
      this.currentEncounter = null;
      document.getElementById('encounter-modal').classList.add('hidden');
    }

    async toggleCameraAR() {
      const videoEl = document.getElementById('ar-video');
      const arLabel = document.querySelector('#btn-toggle-ar span');
      if (this.arActive) {
        CameraAR.stop(videoEl);
        this.arActive = false;
        if (arLabel) arLabel.textContent = 'Ativar Câmera AR';
      } else {
        const ok = await CameraAR.start(videoEl);
        if (ok) {
          this.arActive = true;
          if (arLabel) arLabel.textContent = 'Desativar Câmera AR';
        } else {
          showToast('Câmera indisponível. Mantendo arena vetorial.');
        }
      }
    }

    startChallenge() {
      if (!this.currentEncounter) return;
      const spawn = this.currentEncounter;

      document.getElementById('btn-start-challenge').classList.add('hidden');
      document.getElementById('btn-manual-rep').classList.remove('hidden');

      this.tracker = new ExerciseTracker({
        target: spawn.target || 10,
        unit: spawn.unit || 'reps',
        exerciseType: spawn.exercise_type || '',
        onMotionStatus: (msg) => {
          document.getElementById('motion-indicator').textContent = msg;
        },
        onProgress: ({ elapsedSec, current, target }) => {
          const pct = Math.min(100, Math.round((current / target) * 100));
          const unitLabel = spawn.unit || 'reps';
          document.getElementById('challenge-progress-text').textContent = `${current} / ${target} ${unitLabel}`;
          document.getElementById('challenge-timer').textContent = `${elapsedSec}s`;
          document.getElementById('challenge-progress-fill').style.width = `${pct}%`;
        },
        onComplete: (result) => this.submitCapture(spawn, result)
      });

      this.tracker.start();
    }

    async submitCapture(spawn, result) {
      try {
        const distToSend = Math.round(this.pendingSessionDistance);
        this.pendingSessionDistance = 0;

        const payload = {
          creature_id: spawn.creature_id,
          exercise_type: spawn.exercise_type,
          duration_sec: result.duration_sec,
          distance_m: distToSend,
          reps: Math.max(result.reps, spawn.target || 1)
        };

        const res = await this.apiPost('./api/capture', payload);
        if (res.player) {
          this.player = res.player;
          this.renderHUD();
        }

        SoundFX.playCapture();
        if (res.leveled_up) {
          setTimeout(() => SoundFX.playLevelUp(), 450);
        }

        document.getElementById('challenge-body').classList.add('hidden');
        document.getElementById('capture-celebration').classList.remove('hidden');
        document.getElementById('celeb-title').textContent = `${spawn.name} Capturado`;
        document.getElementById('celeb-subtitle').textContent =
          `Desafio de ${spawn.exercise_type} concluído em ${result.duration_sec}s.`;
        document.getElementById('celeb-xp').textContent = `+${res.xp_gained ?? spawn.xp_reward} XP`;

        const lvlChip = document.getElementById('celeb-levelup');
        if (res.leveled_up) {
          lvlChip.classList.remove('hidden');
          lvlChip.textContent = `Nível ${res.player?.level || ''} alcançado`;
        } else {
          lvlChip.classList.add('hidden');
        }

        this.spawns = this.spawns.filter((s) => s.spawn_id !== spawn.spawn_id);
        this.vitalisMap.setSpawns(this.spawns);
      } catch (_) {
        showToast('Erro ao registrar captura no servidor.');
        this.closeEncounter();
      }
    }

    _bindEvents() {
      document.querySelectorAll('.nav-btn').forEach((btn) => {
        btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
      });

      document.getElementById('btn-mode-toggle').addEventListener('click', () => {
        const nextMode = this.location.mode === 'simulator' ? 'gps' : 'simulator';
        this.location.setMode(nextMode);
      });

      document.getElementById('btn-retry-gps').addEventListener('click', () => {
        this.location.requestGPS();
      });

      document.getElementById('btn-fallback-sim').addEventListener('click', () => {
        this.location.setMode('simulator');
      });

      document.getElementById('btn-center-map').addEventListener('click', () => {
        this.vitalisMap.centerOnPlayer();
      });
      document.getElementById('btn-refresh-spawns').addEventListener('click', () => {
        this.fetchSpawns();
        showToast('Atualizando Vitalis próximos...');
      });

      document.querySelectorAll('.dpad-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.location.moveStep(btn.dataset.dir);
        });
      });

      document.addEventListener('keydown', (e) => {
        const modalOpen = !document.getElementById('encounter-modal').classList.contains('hidden');
        if (modalOpen) {
          if (e.code === 'Space' && this.tracker && this.tracker.running) {
            e.preventDefault();
            this.tracker.triggerRep();
          } else if (e.key === 'Escape') {
            this.closeEncounter();
          }
          return;
        }

        if (this.activeTab !== 'map' || this.location.mode !== 'simulator') return;
        const key = e.key.toLowerCase();
        if (key === 'w' || e.key === 'ArrowUp') {
          e.preventDefault();
          this.location.moveStep('N');
        } else if (key === 's' || e.key === 'ArrowDown') {
          e.preventDefault();
          this.location.moveStep('S');
        } else if (key === 'a' || e.key === 'ArrowLeft') {
          e.preventDefault();
          this.location.moveStep('W');
        } else if (key === 'd' || e.key === 'ArrowRight') {
          e.preventDefault();
          this.location.moveStep('E');
        }
      });

      document.getElementById('btn-close-modal').addEventListener('click', () => this.closeEncounter());
      document.getElementById('btn-celeb-done').addEventListener('click', () => this.closeEncounter());
      document.getElementById('btn-toggle-ar').addEventListener('click', () => this.toggleCameraAR());
      document.getElementById('btn-start-challenge').addEventListener('click', () => this.startChallenge());
      document.getElementById('btn-manual-rep').addEventListener('click', () => {
        if (this.tracker && this.tracker.running) {
          this.tracker.triggerRep();
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const app = new GameApp();
    global.VitalisApp = app;
    app.init();
  });
})(window);
