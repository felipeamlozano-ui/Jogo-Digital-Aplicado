(function (global) {
  'use strict';

  // --- Crisp Athletic SVG Icon System (zero emojis) ---
  const SVG_PATHS = {
    bolt: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    wind: '<path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    award: '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
    trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    compass: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    map: '<polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    refresh: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
    crosshair: '<circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/>',
    play: '<polygon points="5 3 19 12 5 21 5 3"/>',
    close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    chevronUp: '<polyline points="18 15 12 9 6 15"/>',
    chevronDown: '<polyline points="6 9 12 15 18 9"/>',
    chevronLeft: '<polyline points="15 18 9 12 15 6"/>',
    chevronRight: '<polyline points="9 18 15 12 9 6"/>'
  };

  function getIconSVG(name, size = 18, className = '') {
    const inner = SVG_PATHS[name] || SVG_PATHS.activity;
    return `<svg class="v-icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  }

  global.VitalisIcons = {
    get: getIconSVG,
    TYPE_ICON_MAP: {
      Cardio: 'flame',
      Força: 'shield',
      Agilidade: 'bolt',
      Equilíbrio: 'target'
    }
  };

  // --- Web Audio API Sound Effects ---
  const SoundFX = {
    _ctx: null,
    _getCtx() {
      if (!this._ctx) {
        const AudioCtx = global.AudioContext || global.webkitAudioContext;
        if (AudioCtx) {
          this._ctx = new AudioCtx();
        }
      }
      if (this._ctx && this._ctx.state === 'suspended') {
        this._ctx.resume().catch(() => {});
      }
      return this._ctx;
    },
    _tone(freq, duration, type = 'sine', delay = 0, gainVal = 0.16) {
      const ctx = this._getCtx();
      if (!ctx) return;
      const now = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(gainVal, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    },
    playStart() {
      this._tone(440, 0.12, 'triangle', 0, 0.18);
      this._tone(659.25, 0.18, 'triangle', 0.1, 0.18);
    },
    playRep() {
      this._tone(587.33, 0.09, 'sine', 0, 0.15);
      this._tone(880, 0.08, 'sine', 0.04, 0.12);
    },
    playCapture() {
      this._tone(523.25, 0.14, 'triangle', 0, 0.2);
      this._tone(659.25, 0.14, 'triangle', 0.11, 0.2);
      this._tone(783.99, 0.16, 'triangle', 0.22, 0.2);
      this._tone(1046.5, 0.35, 'triangle', 0.34, 0.22);
    },
    playLevelUp() {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      notes.forEach((n, idx) => this._tone(n, 0.22, 'square', idx * 0.09, 0.1));
    }
  };

  // --- Haversine Distance (meters) ---
  function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // --- Location Manager (Real GPS First + Simulator Fallback) ---
  class LocationManager {
    constructor(options = {}) {
      // Fallback reference coordinates used ONLY if user explicitly selects Simulator mode
      this.fallbackLat = options.fallbackLat ?? -23.587416;
      this.fallbackLng = options.fallbackLng ?? -46.657634;
      this.lat = null;
      this.lng = null;
      this.hasFix = false;
      this.mode = options.initialMode || 'gps';
      this.watchId = null;
      this.onMove = options.onMove || (() => {});
      this.onModeChange = options.onModeChange || (() => {});
      this.onGPSState = options.onGPSState || (() => {});
      this.onError = options.onError || (() => {});
      this.stepDeg = 0.00016; // ~17.7m per step
    }

    requestGPS() {
      if (!('geolocation' in navigator)) {
        this.onGPSState('error', 'Geolocalização não suportada neste navegador.');
        return;
      }

      this.mode = 'gps';
      this.onModeChange('gps');
      this.onGPSState('requesting', 'Solicitando acesso à sua localização GPS...');

      const geoOpts = {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
      };

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this._handlePosition(pos);
          this._startWatch(geoOpts);
        },
        (err) => {
          const msg = this._formatGeoError(err);
          this.onGPSState('error', msg);
        },
        geoOpts
      );
    }

    _handlePosition(pos) {
      const newLat = pos.coords.latitude;
      const newLng = pos.coords.longitude;
      const dist = this.hasFix ? haversineDistance(this.lat, this.lng, newLat, newLng) : 0;
      const isFirstFix = !this.hasFix;

      this.lat = newLat;
      this.lng = newLng;
      this.hasFix = true;

      if (isFirstFix) {
        this.onGPSState('ready', 'GPS conectado');
      }
      this.onMove(this.lat, this.lng, dist < 5000 ? dist : 0, isFirstFix);
    }

    _formatGeoError(err) {
      if (!err) return 'Não foi possível obter sua localização.';
      if (err.code === 1) return 'Permissão de localização negada. Ative o GPS nas configurações do navegador.';
      if (err.code === 2) return 'Sinal de GPS indisponível no momento.';
      if (err.code === 3) return 'Tempo esgotado ao buscar sinal GPS.';
      return 'Erro ao acessar localização GPS.';
    }

    setMode(newMode) {
      if (newMode === 'gps') {
        this.requestGPS();
      } else {
        this._stopWatch();
        this.mode = 'simulator';
        if (!this.hasFix) {
          this.lat = this.fallbackLat;
          this.lng = this.fallbackLng;
          this.hasFix = true;
          this.onMove(this.lat, this.lng, 0, true);
        }
        this.onGPSState('ready', 'Modo Simulador ativo');
        this.onModeChange('simulator');
      }
    }

    _startWatch(geoOpts) {
      this._stopWatch();
      this.watchId = navigator.geolocation.watchPosition(
        (pos) => this._handlePosition(pos),
        (err) => {
          if (!this.hasFix) {
            this.onGPSState('error', this._formatGeoError(err));
          }
        },
        geoOpts
      );
    }

    _stopWatch() {
      if (this.watchId !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(this.watchId);
        this.watchId = null;
      }
    }

    moveStep(dir) {
      if (this.mode !== 'simulator' || !this.hasFix) return;
      const oldLat = this.lat;
      const oldLng = this.lng;
      const cosLat = Math.cos((this.lat * Math.PI) / 180) || 1;
      const lngStep = this.stepDeg / cosLat;

      if (dir === 'N') this.lat += this.stepDeg;
      else if (dir === 'S') this.lat -= this.stepDeg;
      else if (dir === 'E') this.lng += lngStep;
      else if (dir === 'W') this.lng -= lngStep;

      const dist = haversineDistance(oldLat, oldLng, this.lat, this.lng);
      this.onMove(this.lat, this.lng, dist, false);
    }
  }

  // --- Exercise Tracker (DeviceMotion Peak Detection + Manual Tap + Timer) ---
  class ExerciseTracker {
    constructor(options = {}) {
      this.target = options.target || 10;
      this.unit = (options.unit || 'reps').toLowerCase();
      this.exerciseType = options.exerciseType || '';
      this.onProgress = options.onProgress || (() => {});
      this.onComplete = options.onComplete || (() => {});
      this.onMotionStatus = options.onMotionStatus || (() => {});

      this.reps = 0;
      this.elapsedSec = 0;
      this.running = false;
      this._timerId = null;
      this._startTime = 0;
      this._lastPeakTime = 0;
      this._motionHandler = null;
      this._motionDetected = false;
    }

    isTimeBased() {
      return (
        this.unit.includes('seg') ||
        this.unit === 's' ||
        this.exerciseType.toLowerCase().includes('prancha') ||
        this.exerciseType.toLowerCase().includes('corrida')
      );
    }

    async start() {
      if (this.running) return;
      this.running = true;
      this.reps = 0;
      this.elapsedSec = 0;
      this._startTime = Date.now();
      this._lastPeakTime = 0;

      SoundFX.playStart();
      await this._attachMotionListener();

      this._timerId = setInterval(() => {
        if (!this.running) return;
        this.elapsedSec = Math.floor((Date.now() - this._startTime) / 1000);
        const current = this.isTimeBased()
          ? Math.min(this.target, this.elapsedSec + this.reps)
          : this.reps;

        this.onProgress({
          reps: this.reps,
          elapsedSec: this.elapsedSec,
          current,
          target: this.target
        });

        if (current >= this.target) {
          this.finish();
        }
      }, 250);
    }

    async _attachMotionListener() {
      if (typeof global.DeviceMotionEvent === 'undefined') {
        this.onMotionStatus('Sensor de movimento indisponível. Utilize o botão de toque ou Espaço.');
        return;
      }

      if (typeof global.DeviceMotionEvent.requestPermission === 'function') {
        try {
          const res = await global.DeviceMotionEvent.requestPermission();
          if (res !== 'granted') {
            this.onMotionStatus('Permissão de movimento negada. Utilize o botão de toque.');
            return;
          }
        } catch (_) {
          this.onMotionStatus('Utilize o botão de toque para registrar repetições.');
          return;
        }
      }

      this._motionHandler = (event) => {
        if (!this.running) return;
        const acc = event.acceleration && event.acceleration.x !== null
          ? event.acceleration
          : event.accelerationIncludingGravity;
        if (!acc) return;

        const x = acc.x || 0;
        const y = acc.y || 0;
        const z = acc.z || 0;
        const mag = Math.sqrt(x * x + y * y + z * z);

        const isGravityIncluded = !(event.acceleration && event.acceleration.x !== null);
        const threshold = isGravityIncluded ? 15.8 : 6.2;
        const now = Date.now();

        if (mag > threshold && now - this._lastPeakTime > 380) {
          this._lastPeakTime = now;
          if (!this._motionDetected) {
            this._motionDetected = true;
            this.onMotionStatus('Acelerômetro ativo. Mantenha o ritmo do exercício.');
          }
          this.triggerRep();
        }
      };

      global.addEventListener('devicemotion', this._motionHandler);
      this.onMotionStatus('Sensor pronto. Movimente o aparelho ou toque no botão abaixo.');
    }

    triggerRep() {
      if (!this.running) return;
      this.reps += 1;
      SoundFX.playRep();
      this.elapsedSec = Math.floor((Date.now() - this._startTime) / 1000);
      const current = this.isTimeBased()
        ? Math.min(this.target, this.elapsedSec + this.reps)
        : this.reps;

      this.onProgress({
        reps: this.reps,
        elapsedSec: this.elapsedSec,
        current,
        target: this.target
      });

      if (current >= this.target) {
        this.finish();
      }
    }

    finish() {
      if (!this.running) return;
      const finalDuration = Math.max(1, Math.floor((Date.now() - this._startTime) / 1000));
      const finalReps = this.reps;
      this.stop();
      this.onComplete({
        reps: finalReps,
        duration_sec: finalDuration
      });
    }

    stop() {
      this.running = false;
      if (this._timerId) {
        clearInterval(this._timerId);
        this._timerId = null;
      }
      if (this._motionHandler) {
        global.removeEventListener('devicemotion', this._motionHandler);
        this._motionHandler = null;
      }
    }
  }

  // --- Camera AR Lite ---
  const CameraAR = {
    _stream: null,
    async start(videoEl) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return false;
      }
      try {
        this._stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false
        });
        videoEl.srcObject = this._stream;
        videoEl.classList.remove('hidden');
        return true;
      } catch (_) {
        return false;
      }
    },
    stop(videoEl) {
      if (this._stream) {
        this._stream.getTracks().forEach((t) => t.stop());
        this._stream = null;
      }
      if (videoEl) {
        videoEl.srcObject = null;
        videoEl.classList.add('hidden');
      }
    }
  };

  global.VitalisSensors = {
    SoundFX,
    haversineDistance,
    LocationManager,
    ExerciseTracker,
    CameraAR
  };
})(window);
