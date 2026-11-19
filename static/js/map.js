(function (global) {
  'use strict';

  const INTERACTION_RADIUS_M = 60;

  const TYPE_COLORS = {
    Cardio: '#E11D48',
    Força: '#D97706',
    Agilidade: '#0284C7',
    Equilíbrio: '#7C3AED'
  };

  class VitalisMap {
    constructor(options = {}) {
      this.containerId = options.containerId || 'map';
      this.onSpawnClick = options.onSpawnClick || (() => {});
      this.onOutOfRange = options.onOutOfRange || (() => {});

      this.map = null;
      this.playerMarker = null;
      this.radiusCircle = null;
      this.spawnMarkers = [];
      this.playerLat = null;
      this.playerLng = null;
      this.spawns = [];
      this.initialized = false;
    }

    init(lat, lng) {
      if (this.initialized) {
        this.updatePlayerPosition(lat, lng, true);
        return;
      }
      this.initialized = true;
      this.playerLat = lat;
      this.playerLng = lng;

      this.map = L.map(this.containerId, {
        zoomControl: false,
        attributionControl: true
      }).setView([lat, lng], 17);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(this.map);

      const playerIconSvg = global.VitalisIcons
        ? global.VitalisIcons.get('user', 14)
        : '';

      const playerIcon = L.divIcon({
        className: 'player-div-icon',
        html: `
          <div class="player-marker-wrap">
            <div class="player-pulse"></div>
            <div class="player-avatar-dot">${playerIconSvg}</div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      this.playerMarker = L.marker([lat, lng], {
        icon: playerIcon,
        zIndexOffset: 1000
      }).addTo(this.map);

      this.radiusCircle = L.circle([lat, lng], {
        radius: INTERACTION_RADIUS_M,
        color: '#10b981',
        fillColor: '#10b981',
        fillOpacity: 0.14,
        weight: 2,
        dashArray: '6, 6'
      }).addTo(this.map);
    }

    updatePlayerPosition(lat, lng, panToPlayer = true) {
      if (!this.initialized) {
        this.init(lat, lng);
        return;
      }
      this.playerLat = lat;
      this.playerLng = lng;
      if (this.playerMarker) {
        this.playerMarker.setLatLng([lat, lng]);
      }
      if (this.radiusCircle) {
        this.radiusCircle.setLatLng([lat, lng]);
      }
      if (panToPlayer && this.map) {
        this.map.panTo([lat, lng], { animate: true, duration: 0.35 });
      }
      this._refreshSpawnRangeClasses();
    }

    centerOnPlayer() {
      if (this.map && this.playerLat !== null && this.playerLng !== null) {
        this.map.setView([this.playerLat, this.playerLng], 17, { animate: true });
      }
    }

    invalidateSize() {
      if (this.map) {
        setTimeout(() => this.map.invalidateSize(), 60);
      }
    }

    setSpawns(spawns) {
      this.spawns = Array.isArray(spawns) ? spawns : [];
      this._clearSpawns();
      if (!this.initialized || this.playerLat === null) return;

      const Icons = global.VitalisIcons;

      this.spawns.forEach((spawn) => {
        const dist = global.VitalisSensors.haversineDistance(
          this.playerLat,
          this.playerLng,
          spawn.lat,
          spawn.lng
        );
        const inRange = dist <= INTERACTION_RADIUS_M;
        const color = spawn.svg_color || TYPE_COLORS[spawn.type] || '#10b981';
        const iconKey =
          spawn.icon ||
          (Icons && Icons.TYPE_ICON_MAP[spawn.type]) ||
          'bolt';
        const iconSvg = Icons ? Icons.get(iconKey, 20) : '';

        const icon = L.divIcon({
          className: 'spawn-div-icon',
          html: `
            <div class="spawn-marker ${inRange ? '' : 'out-of-range'}" data-spawn-id="${spawn.spawn_id}">
              <div class="spawn-bubble" style="border-color: ${color}; color: ${color};">
                ${iconSvg}
              </div>
              <span class="spawn-label">${spawn.name}</span>
            </div>
          `,
          iconSize: [74, 68],
          iconAnchor: [37, 34]
        });

        const marker = L.marker([spawn.lat, spawn.lng], { icon }).addTo(this.map);
        marker.on('click', () => {
          const currentDist = global.VitalisSensors.haversineDistance(
            this.playerLat,
            this.playerLng,
            spawn.lat,
            spawn.lng
          );
          if (currentDist <= INTERACTION_RADIUS_M) {
            this.onSpawnClick(spawn, currentDist);
          } else {
            this.onOutOfRange(spawn, currentDist);
          }
        });

        this.spawnMarkers.push({ marker, spawn });
      });
    }

    _refreshSpawnRangeClasses() {
      if (this.playerLat === null) return;
      this.spawnMarkers.forEach(({ marker, spawn }) => {
        const el = marker.getElement();
        if (!el) return;
        const box = el.querySelector('.spawn-marker');
        if (!box) return;
        const dist = global.VitalisSensors.haversineDistance(
          this.playerLat,
          this.playerLng,
          spawn.lat,
          spawn.lng
        );
        if (dist <= INTERACTION_RADIUS_M) {
          box.classList.remove('out-of-range');
        } else {
          box.classList.add('out-of-range');
        }
      });
    }

    _clearSpawns() {
      this.spawnMarkers.forEach(({ marker }) => {
        if (this.map) this.map.removeLayer(marker);
      });
      this.spawnMarkers = [];
    }
  }

  global.VitalisMap = VitalisMap;
  global.INTERACTION_RADIUS_M = INTERACTION_RADIUS_M;
})(window);
