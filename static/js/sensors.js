(function (global) {
  'use strict';

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

  // --- Location Manager (Real GPS + Desktop Simulator) ---
  class LocationManager {
    constructor(options = {}) {
      // Default: Parque Ibirapuera, São Paulo
      this.lat = options.initialLat ?? -23.587416;
      this.lng = options.initialLng ?? -46.657634;
      this.mode = options.initialMode || 'simulator';
      this.watchId = null;
      this.onMove = options.onMove || (() => {});
      this.onModeChange = options.onModeChange || (() => {});
      this.onError = options.onError || (() => {});
      this.stepDeg = 0.00016; // ~17.7m per step
    }

    setMode(newMode) {
      if (newMode === this.mode) return;
      if (newMode === 'gps') {
        if (!('geolocation' in navigator)) {
          this.onError('GPS não disponível neste navegador. Usando Simulador.');
          return;
        }
        this.mode = 'gps';
        this.onModeChange('gps');
        this._startWatch();
      } else {
        this._stopWatch();
        this.mode = 'simulator';
        this.onModeChange('simulator');
      }
    }

    _startWatch() {
      this._stopWatch();
      this.watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const newLat = pos.coords.latitude;
          const newLng = pos.coords.longitude;
          const dist = haversineDistance(this.lat, this.lng, newLat, newLng);
          this.lat = newLat;
          this.lng = newLng;
          this.onMove(this.lat, this.lng, dist < 5000 ? dist : 0);
        },
        (err) => {
          let msg = 'Erro ao acessar GPS.';
          if (err.code === 1) msg = 'Permissão de GPS negada. Voltando para o Simulador.';
          else if (err.code === 2) msg = 'Sinal de GPS indisponível. Voltando para o Simulador.';
          else if (err.code === 3) msg = 'Tempo limite de GPS esgotado. Voltando para o Simulador.';
          this.onError(msg);
          this.setMode('simulator');
        },
        {
          enableHighAccuracy: true,
          maximumAge: 3000,
          timeout: 10000
        }
      );
    }

    _stopWatch() {
      if (this.watchId !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(this.watchId);
        this.watchId = null;
      }
    }

    moveStep(dir) {
      if (this.mode !== 'simulator') return;
      const oldLat = this.lat;
      const oldLng = this.lng;
      const cosLat = Math.cos((this.lat * Math.PI) / 180) || 1;
      const lngStep = this.stepDeg / cosLat;

      if (dir === 'N') this.lat += this.stepDeg;
      else if (dir === 'S') this.lat -= this.stepDeg;
      else if (dir === 'E') this.lng += lngStep;
      else if (dir === 'W') this.lng -= lngStep;

      const dist = haversineDistance(oldLat, oldLng, this.lat, this.lng);
      this.onMove(this.lat, this.lng, dist);
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
        this.onMotionStatus('Sensor de movimento indisponível — use o botão de toque ou Espaço.');
        return;
      }

      if (typeof global.DeviceMotionEvent.requestPermission === 'function') {
        try {
          const res = await global.DeviceMotionEvent.requestPermission();
          if (res !== 'granted') {
            this.onMotionStatus('Permissão de movimento negada — use o botão de toque.');
            return;
          }
        } catch (_) {
          this.onMotionStatus('Use o botão de toque para registrar movimentos.');
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
            this.onMotionStatus('📱 Sensor de movimento ativo! Continue se mexendo!');
          }
          this.triggerRep();
        }
      };

      global.addEventListener('devicemotion', this._motionHandler);
      this.onMotionStatus('📱 Sensor pronto! Mexa o celular ou toque no botão abaixo.');
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
