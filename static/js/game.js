(function (global) {
  'use strict';

  const { SoundFX, LocationManager, ExerciseTracker, CameraAR } = global.VitalisSensors;

  const TYPE_COLORS = {
    Cardio: '#ef4444',
    Força: '#f59e0b',
    Agilidade: '#38bdf8',
    Equilíbrio: '#a855f7'
  };

  const TYPE_EMOJIS = {
    Cardio: '🔥',
    Força: '💪',
    Agilidade: '⚡',
    Equilíbrio: '🧘'
  };

  function createCreatureSVG(creature) {
    const color = creature.svg_color || TYPE_COLORS[creature.type] || '#10b981';
    const emoji = creature.emoji || TYPE_EMOJIS[creature.type] || '✨';
    return `
      <svg viewBox="0 0 120 120" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="grad-${creature.creature_id || creature.id || 'v'}" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.45"/>
            <stop offset="55%" stop-color="${color}" stop-opacity="0.95"/>
            <stop offset="100%" stop-color="#0f172a" stop-opacity="0.95"/>
          </radialGradient>
        </defs>
        <circle cx="60" cy="60" r="46" fill="url(#grad-${creature.creature_id || creature.id || 'v'})" stroke="#ffffff" stroke-opacity="0.4" stroke-width="3"/>
        <circle cx="44" cy="52" r="6" fill="#ffffff"/>
        <circle cx="76" cy="52" r="6" fill="#ffffff"/>
        <circle cx="45" cy="52" r="3" fill="#0f172a"/>
        <circle cx="77" cy="52" r="3" fill="#0f172a"/>
        <path d="M47 70 Q60 80 73 70" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round"/>
        <text x="60" y="26" text-anchor="middle" font-size="18">${emoji}</text>
      </svg>
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
        initialMode: 'simulator',
        onMove: (lat, lng, deltaM) => this.handlePlayerMove(lat, lng, deltaM),
        onModeChange: (mode) => this.updateModeUI(mode),
        onError: (msg) => showToast(msg, 3500)
      });

      this.vitalisMap = new global.VitalisMap({
        containerId: 'map',
        lat: this.location.lat,
        lng: this.location.lng,
        onSpawnClick: (spawn) => this.openEncounter(spawn),
        onOutOfRange: (spawn, dist) => {
          const remaining = Math.max(1, Math.round(dist - global.INTERACTION_RADIUS_M));
          showToast(`${spawn.name} está a ${Math.round(dist)}m! Aproxime-se mais ${remaining}m.`);
        }
      });
    }

    async init() {
      this._registerSW();
      this.vitalisMap.init(this.location.lat, this.location.lng);
      this._bindEvents();
      this.updateModeUI(this.location.mode);

      await this.fetchPlayer();
      await this.fetchSpawns();
    }

    _registerSW() {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
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
      } catch (err) {
        showToast('Erro ao carregar dados do jogador.');
      }
    }

    async fetchSpawns() {
      try {
        const data = await this.apiGet(
          `./api/spawns?lat=${this.location.lat.toFixed(6)}&lng=${this.location.lng.toFixed(6)}`
        );
        this.spawns = data.spawns || [];
        this.vitalisMap.setSpawns(this.spawns);
      } catch (err) {
        showToast('Erro ao buscar Vitalis próximos.');
      }
    }

    handlePlayerMove(lat, lng, deltaM) {
      this.vitalisMap.updatePlayerPosition(lat, lng, true);
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
      grid.innerHTML = '<p style="color:var(--text-muted)">Carregando FitDex...</p>';
      try {
        const data = await this.apiGet('./api/fitdex');
        const creatures = data.creatures || [];
        const capturedTotal = creatures.filter((c) => (c.captured_count || 0) > 0).length;
        summary.textContent = `${capturedTotal} de ${creatures.length} Vitalis descobertos`;

        grid.innerHTML = creatures
          .map((c) => {
            const unlocked = (c.captured_count || 0) > 0;
            return `
              <div class="fitdex-card ${unlocked ? '' : 'locked'}">
                <div class="creature-art-wrap">${createCreatureSVG(c)}</div>
                <div class="fitdex-name">${unlocked ? c.name : '???'}</div>
                <div class="fitdex-meta">${c.type} • ${c.exercise_type}</div>
                <div class="fitdex-count">
                  ${unlocked ? `Capturados: ${c.captured_count}` : 'Não capturado'}
                </div>
              </div>
            `;
          })
          .join('');
      } catch (_) {
        grid.innerHTML = '<p style="color:var(--danger)">Erro ao carregar FitDex.</p>';
      }
    }

    async loadMissions() {
      const list = document.getElementById('missions-list');
      list.innerHTML = '<p style="color:var(--text-muted)">Carregando missões...</p>';
      try {
        const data = await this.apiGet('./api/missions');
        const missions = data.missions || [];
        list.innerHTML = missions
          .map((m) => {
            const pct = Math.min(100, Math.round(((m.progress || 0) / (m.target || 1)) * 100));
            return `
              <div class="mission-card ${m.completed ? 'completed' : ''}">
                <div class="mission-top">
                  <div class="mission-title">${m.completed ? '✅ ' : ''}${m.title}</div>
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
        list.innerHTML = '<p style="color:var(--danger)">Erro ao carregar missões.</p>';
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
                if (typeof b === 'string') return `<span class="badge-chip">🏅 ${b}</span>`;
                return `<span class="badge-chip" title="${b.description || ''}">${b.icon || '🏅'} ${b.name || b.id}</span>`;
              })
              .join('')
          : '<span class="view-subtitle">Complete exercícios para desbloquear medalhas!</span>';

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
        spawn.description || `Complete o desafio de ${spawn.exercise_type} para capturar ${spawn.name}!`;
      document.getElementById('enc-type').textContent = spawn.type || 'Vitalis';
      document.getElementById('enc-rarity').textContent = spawn.rarity || 'Comum';
      document.getElementById('enc-exercise').textContent = spawn.exercise_type;
      document.getElementById('enc-xp').textContent = `+${spawn.xp_reward} XP`;

      document.getElementById('creature-svg-container').innerHTML = createCreatureSVG(spawn);

      const unitLabel = spawn.unit || 'reps';
      document.getElementById('challenge-progress-text').textContent = `0 / ${spawn.target} ${unitLabel}`;
      document.getElementById('challenge-timer').textContent = '⏱️ 0s';
      document.getElementById('challenge-progress-fill').style.width = '0%';
      document.getElementById('motion-indicator').textContent =
        'Pronto para começar! Use o sensor do celular ou o botão de ritmo.';

      document.getElementById('btn-start-challenge').classList.remove('hidden');
      document.getElementById('btn-manual-rep').classList.add('hidden');
      document.getElementById('challenge-body').classList.remove('hidden');
      document.getElementById('capture-celebration').classList.add('hidden');
      document.getElementById('btn-toggle-ar').textContent = '📷 Ativar Câmera AR';

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
      const btn = document.getElementById('btn-toggle-ar');
      if (this.arActive) {
        CameraAR.stop(videoEl);
        this.arActive = false;
        btn.textContent = '📷 Ativar Câmera AR';
      } else {
        const ok = await CameraAR.start(videoEl);
        if (ok) {
          this.arActive = true;
          btn.textContent = '🚫 Desativar AR';
        } else {
          showToast('Câmera indisponível. Usando modo AR animado!');
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
          document.getElementById('challenge-timer').textContent = `⏱️ ${elapsedSec}s`;
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
        document.getElementById('celeb-title').textContent = `${spawn.name} Capturado!`;
        document.getElementById('celeb-subtitle').textContent =
          `Desafio de ${spawn.exercise_type} concluído em ${result.duration_sec}s.`;
        document.getElementById('celeb-xp').textContent = `+${res.xp_gained ?? spawn.xp_reward} XP`;

        const lvlChip = document.getElementById('celeb-levelup');
        if (res.leveled_up) {
          lvlChip.classList.remove('hidden');
          lvlChip.textContent = `🎉 Nível ${res.player?.level || ''}!`;
        } else {
          lvlChip.classList.add('hidden');
        }

        // Remove captured spawn locally and refresh spawns
        this.spawns = this.spawns.filter((s) => s.spawn_id !== spawn.spawn_id);
        this.vitalisMap.setSpawns(this.spawns);
      } catch (err) {
        showToast('Erro ao registrar captura no servidor.');
        this.closeEncounter();
      }
    }

    _bindEvents() {
      // Bottom nav
      document.querySelectorAll('.nav-btn').forEach((btn) => {
        btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
      });

      // GPS / Simulator toggle
      document.getElementById('btn-mode-toggle').addEventListener('click', () => {
        const nextMode = this.location.mode === 'simulator' ? 'gps' : 'simulator';
        this.location.setMode(nextMode);
      });

      // Map actions
      document.getElementById('btn-center-map').addEventListener('click', () => {
        this.vitalisMap.centerOnPlayer();
      });
      document.getElementById('btn-refresh-spawns').addEventListener('click', () => {
        this.fetchSpawns();
        showToast('Buscando Vitalis próximos...');
      });

      // Simulator D-pad
      document.querySelectorAll('.dpad-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.location.moveStep(btn.dataset.dir);
        });
      });

      // Keyboard WASD / Arrows + Space for rep
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

      // Modal controls
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
