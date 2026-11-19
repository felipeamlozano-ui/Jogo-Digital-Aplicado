(function (global) {
  'use strict';

  const STORAGE_KEY = 'vitalis_local_state_v3';

  const EXERCISE_METS = {
    Polichinelos: 8.0,
    Agachamentos: 5.0,
    'Corrida/Caminhada': 7.0,
    Prancha: 3.8,
    walking: 3.5
  };

  const CREATURES = [
    {
      id: 'voltix',
      name: 'Voltix',
      type: 'Cardio',
      rarity: 'Comum',
      exercise_type: 'Polichinelos',
      met: 8.0,
      target_reps_or_sec: 15,
      unit: 'reps',
      xp_reward: 60,
      svg_color: '#FF6B00',
      icon: 'bolt',
      description: 'Criatura elétrica que recarrega energia com saltos rápidos e coordenados.'
    },
    {
      id: 'pulsor',
      name: 'Pulsor',
      type: 'Cardio',
      rarity: 'Incomum',
      exercise_type: 'Corrida/Caminhada',
      met: 7.0,
      target_reps_or_sec: 30,
      unit: 'seg',
      xp_reward: 85,
      svg_color: '#E11D48',
      icon: 'flame',
      description: 'Nascido do ritmo cardíaco acelerado, acompanha corredores em trajetos urbanos.'
    },
    {
      id: 'aerowing',
      name: 'Aerowing',
      type: 'Cardio',
      rarity: 'Raro',
      exercise_type: 'Polichinelos',
      met: 8.0,
      target_reps_or_sec: 25,
      unit: 'reps',
      xp_reward: 120,
      svg_color: '#0284C7',
      icon: 'wind',
      description: 'Espírito dos ventos que aparece para quem mantém o fôlego elevado.'
    },
    {
      id: 'ferrodon',
      name: 'Ferrodon',
      type: 'Força',
      rarity: 'Comum',
      exercise_type: 'Agachamentos',
      met: 5.0,
      target_reps_or_sec: 12,
      unit: 'reps',
      xp_reward: 65,
      svg_color: '#B45309',
      icon: 'shield',
      description: 'Guardião de base firme cuja couraça fortalece a cada agachamento.'
    },
    {
      id: 'titanox',
      name: 'Titanox',
      type: 'Força',
      rarity: 'Raro',
      exercise_type: 'Agachamentos',
      met: 5.0,
      target_reps_or_sec: 20,
      unit: 'reps',
      xp_reward: 130,
      svg_color: '#475569',
      icon: 'shield',
      description: 'Colosso de aço que exige estabilidade e cadência de treino.'
    },
    {
      id: 'brasafor',
      name: 'Brasafor',
      type: 'Força',
      rarity: 'Épico',
      exercise_type: 'Agachamentos',
      met: 5.0,
      target_reps_or_sec: 30,
      unit: 'reps',
      xp_reward: 180,
      svg_color: '#DC2626',
      icon: 'flame',
      description: 'Guardião de alta intensidade que desperta nos treinos de força.'
    },
    {
      id: 'zephyrin',
      name: 'Zephyrin',
      type: 'Agilidade',
      rarity: 'Comum',
      exercise_type: 'Polichinelos',
      met: 8.0,
      target_reps_or_sec: 18,
      unit: 'reps',
      xp_reward: 70,
      svg_color: '#16A34A',
      icon: 'wind',
      description: 'Ágil como o vento, desafia reflexos e coordenação motora.'
    },
    {
      id: 'velocir',
      name: 'Velocir',
      type: 'Agilidade',
      rarity: 'Incomum',
      exercise_type: 'Corrida/Caminhada',
      met: 7.0,
      target_reps_or_sec: 45,
      unit: 'seg',
      xp_reward: 100,
      svg_color: '#0891B2',
      icon: 'activity',
      description: 'Velocista das trilhas urbanas, sempre em busca de novos recordes.'
    },
    {
      id: 'relampix',
      name: 'Relampix',
      type: 'Agilidade',
      rarity: 'Épico',
      exercise_type: 'Corrida/Caminhada',
      met: 7.0,
      target_reps_or_sec: 60,
      unit: 'seg',
      xp_reward: 190,
      svg_color: '#D97706',
      icon: 'bolt',
      description: 'Corredor cintilante que cruza quarteirões inteiros em segundos.'
    },
    {
      id: 'equilibra',
      name: 'Equilibra',
      type: 'Equilíbrio',
      rarity: 'Comum',
      exercise_type: 'Prancha',
      met: 3.8,
      target_reps_or_sec: 20,
      unit: 'seg',
      xp_reward: 75,
      svg_color: '#9333EA',
      icon: 'target',
      description: 'Criatura serena que fortalece o core e o controle postural.'
    },
    {
      id: 'lotusaur',
      name: 'Lotusaur',
      type: 'Equilíbrio',
      rarity: 'Incomum',
      exercise_type: 'Prancha',
      met: 3.8,
      target_reps_or_sec: 35,
      unit: 'seg',
      xp_reward: 110,
      svg_color: '#DB2777',
      icon: 'award',
      description: 'Guardião da estabilidade corporal, responde à firmeza abdominal.'
    },
    {
      id: 'zenithon',
      name: 'Zenithon',
      type: 'Equilíbrio',
      rarity: 'Raro',
      exercise_type: 'Prancha',
      met: 3.8,
      target_reps_or_sec: 50,
      unit: 'seg',
      xp_reward: 150,
      svg_color: '#4F46E5',
      icon: 'compass',
      description: 'Dragão contemplativo que testa resistência isométrica ao máximo.'
    }
  ];

  function createDefaultProfile(id = 1, username = 'AtletaVitalis', weightKg = 70.0) {
    return {
      id,
      username,
      weight_kg: weightKg,
      level: 1,
      xp: 0,
      total_distance_m: 0,
      total_calories: 0,
      total_exercises: 0,
      captures: {}
    };
  }

  function loadState() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.profiles && parsed.activeId && parsed.profiles[parsed.activeId]) {
          return parsed;
        }
      }
    } catch (_) {}

    const def = createDefaultProfile(1, 'AtletaVitalis', 70.0);
    return {
      activeId: 1,
      nextId: 2,
      profiles: { 1: def }
    };
  }

  function saveState(state) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {}
  }

  function getActiveProfile(state) {
    return state.profiles[state.activeId] || Object.values(state.profiles)[0];
  }

  function computeBadges(player) {
    const badges = [];
    const captures = player.captures || {};
    const uniqueCount = Object.keys(captures).length;
    if (player.total_exercises >= 1) {
      badges.push({
        id: 'first_step',
        name: 'Primeiro Passo',
        icon: 'award',
        description: 'Completou seu primeiro desafio físico.'
      });
    }
    if (uniqueCount >= 3) {
      badges.push({
        id: 'collector_3',
        name: 'Explorador Vitalis',
        icon: 'compass',
        description: 'Capturou 3 espécies diferentes de Vitalis.'
      });
    }
    if (player.total_exercises >= 10) {
      badges.push({
        id: 'athlete_10',
        name: 'Atleta Dedicado',
        icon: 'trophy',
        description: 'Concluiu 10 exercícios físicos.'
      });
    }
    if (player.total_distance_m >= 500) {
      badges.push({
        id: 'walker_500',
        name: 'Caminhante Urbano',
        icon: 'activity',
        description: 'Percorreu 500 m explorando o mapa.'
      });
    }
    return badges;
  }

  function buildPlayerResponse(p) {
    return {
      id: p.id,
      username: p.username,
      weight_kg: Number(p.weight_kg) || 70.0,
      level: p.level,
      xp: p.xp,
      next_level_xp: p.level * 100,
      total_distance_m: Math.round(p.total_distance_m || 0),
      total_calories: Number((p.total_calories || 0).toFixed(1)),
      total_exercises: p.total_exercises || 0,
      badges: computeBadges(p)
    };
  }

  function calculateKcal(exerciseType, weightKg, durationSec, reps = 0, distanceM = 0) {
    const met = EXERCISE_METS[exerciseType] || 5.0;
    const w = Math.max(25, Math.min(250, Number(weightKg) || 70.0));
    const effectiveSec = Math.max(Number(durationSec) || 1, (Number(reps) || 0) * 2);
    let kcal = ((met * 3.5 * w) / 200.0) * (effectiveSec / 60.0);
    if (distanceM > 0) {
      const walkMinutes = (Number(distanceM) / 1.35) / 60.0;
      kcal += ((EXERCISE_METS.walking * 3.5 * w) / 200.0) * walkMinutes;
    }
    return Number(kcal.toFixed(1));
  }

  const LocalGameEngine = {
    EXERCISE_METS,

    calculateWalkingKcal(distanceM, weightKg = 70.0) {
      if (!distanceM || distanceM <= 0) return 0;
      const w = Math.max(25, Math.min(250, Number(weightKg) || 70.0));
      const walkMinutes = (Number(distanceM) / 1.35) / 60.0;
      return ((EXERCISE_METS.walking * 3.5 * w) / 200.0) * walkMinutes;
    },

    getPlayer() {
      const state = loadState();
      return buildPlayerResponse(getActiveProfile(state));
    },

    updatePlayerProfile({ username, weight_kg }) {
      const state = loadState();
      const p = getActiveProfile(state);
      if (typeof username === 'string' && username.trim()) {
        p.username = username.trim().slice(0, 32);
      }
      if (weight_kg !== undefined && weight_kg !== null && !Number.isNaN(Number(weight_kg))) {
        p.weight_kg = Math.max(25, Math.min(250, Number(weight_kg)));
      }
      saveState(state);
      return buildPlayerResponse(p);
    },

    switchOrCreatePlayer(username, weight_kg = 70.0) {
      const cleanName = (username || '').trim().slice(0, 32);
      if (!cleanName) {
        return this.getPlayer();
      }
      const state = loadState();
      const existing = Object.values(state.profiles).find(
        (prof) => prof.username.toLowerCase() === cleanName.toLowerCase()
      );
      if (existing) {
        state.activeId = existing.id;
        if (weight_kg !== undefined && weight_kg !== null && !Number.isNaN(Number(weight_kg))) {
          existing.weight_kg = Math.max(25, Math.min(250, Number(weight_kg)));
        }
        saveState(state);
        return buildPlayerResponse(existing);
      }
      const newId = state.nextId || (Object.keys(state.profiles).length + 1);
      state.nextId = newId + 1;
      const w = Math.max(25, Math.min(250, Number(weight_kg) || 70.0));
      const newProf = createDefaultProfile(newId, cleanName, w);
      state.profiles[newId] = newProf;
      state.activeId = newId;
      saveState(state);
      return buildPlayerResponse(newProf);
    },

    getSpawns(lat, lng) {
      const baseLat = Number(lat) || -23.587416;
      const baseLng = Number(lng) || -46.657634;
      const cosLat = Math.cos((baseLat * Math.PI) / 180) || 1;
      const spawns = [];
      const count = 8;

      for (let i = 0; i < count; i++) {
        const creature = CREATURES[Math.floor(Math.random() * CREATURES.length)];
        const distM = i < 2 ? 25 + i * 12 + Math.random() * 10 : 55 + ((i - 2) / (count - 2)) * 115 + Math.random() * 12;
        const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.45;
        const dLat = (distM * Math.cos(angle)) / 111320;
        const dLng = (distM * Math.sin(angle)) / (111320 * cosLat);

        spawns.push({
          spawn_id: `sp_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
          creature_id: creature.id,
          name: creature.name,
          type: creature.type,
          rarity: creature.rarity,
          exercise_type: creature.exercise_type,
          met: creature.met,
          target: creature.target_reps_or_sec,
          unit: creature.unit,
          xp_reward: creature.xp_reward,
          svg_color: creature.svg_color,
          icon: creature.icon,
          description: creature.description,
          lat: Number((baseLat + dLat).toFixed(6)),
          lng: Number((baseLng + dLng).toFixed(6))
        });
      }
      return { spawns };
    },

    postCapture(body) {
      const state = loadState();
      const p = getActiveProfile(state);
      const creature = CREATURES.find((c) => c.id === body.creature_id) || CREATURES[0];
      const xpGained = creature.xp_reward;
      const distM = Math.max(0, Number(body.distance_m) || 0);
      const caloriesBurned = calculateKcal(
        body.exercise_type || creature.exercise_type,
        p.weight_kg,
        body.duration_sec,
        body.reps,
        distM
      );

      p.total_exercises += 1;
      p.total_distance_m += distM;
      p.total_calories = Number(((p.total_calories || 0) + caloriesBurned).toFixed(1));
      p.xp += xpGained;

      let leveledUp = false;
      while (p.xp >= p.level * 100) {
        p.xp -= p.level * 100;
        p.level += 1;
        leveledUp = true;
      }

      if (!p.captures[creature.id]) {
        p.captures[creature.id] = {
          count: 1,
          first_captured_at: new Date().toISOString()
        };
      } else {
        p.captures[creature.id].count += 1;
      }

      saveState(state);
      return {
        captured: true,
        creature,
        xp_gained: xpGained,
        calories_burned: caloriesBurned,
        leveled_up: leveledUp,
        player: buildPlayerResponse(p)
      };
    },

    getFitdex() {
      const state = loadState();
      const p = getActiveProfile(state);
      const captures = p.captures || {};
      return {
        creatures: CREATURES.map((c) => {
          const cap = captures[c.id];
          return {
            ...c,
            captured_count: cap ? cap.count : 0,
            first_captured_at: cap ? cap.first_captured_at : null
          };
        })
      };
    },

    getMissions() {
      const state = loadState();
      const p = getActiveProfile(state);
      const uniqueCount = Object.keys(p.captures || {}).length;
      const missions = [
        {
          id: 'm_exercises_3',
          title: 'Aquecimento Diário',
          description: 'Complete 3 desafios físicos para capturar Vitalis.',
          target: 3,
          progress: Math.min(3, p.total_exercises),
          unit: 'exercícios',
          completed: p.total_exercises >= 3,
          xp_reward: 100
        },
        {
          id: 'm_distance_200',
          title: 'Exploração Ativa',
          description: 'Percorra 200 metros no mapa (GPS ou Simulador).',
          target: 200,
          progress: Math.min(200, Math.round(p.total_distance_m)),
          unit: 'm',
          completed: p.total_distance_m >= 200,
          xp_reward: 120
        },
        {
          id: 'm_species_4',
          title: 'Colecionador Vitalis',
          description: 'Registre 4 espécies diferentes na sua FitDex.',
          target: 4,
          progress: Math.min(4, uniqueCount),
          unit: 'espécies',
          completed: uniqueCount >= 4,
          xp_reward: 150
        },
        {
          id: 'm_calories_100',
          title: 'Queima Metabólica',
          description: 'Acumule 100 kcal queimadas em desafios.',
          target: 100,
          progress: Math.min(100, Math.round(p.total_calories)),
          unit: 'kcal',
          completed: p.total_calories >= 100,
          xp_reward: 150
        }
      ];
      return { missions };
    },

    getLeaderboard() {
      const state = loadState();
      const realPlayers = Object.values(state.profiles).map((p) => ({
        id: p.id,
        username: p.username,
        level: p.level,
        xp: p.xp,
        total_calories: Number((p.total_calories || 0).toFixed(1)),
        total_exercises: p.total_exercises || 0
      }));
      realPlayers.sort(
        (a, b) =>
          (b.level - a.level) ||
          (b.xp - a.xp) ||
          (b.total_calories - a.total_calories) ||
          (b.total_exercises - a.total_exercises)
      );
      return {
        leaderboard: realPlayers.map((entry, idx) => ({
          rank: idx + 1,
          ...entry
        }))
      };
    }
  };

  global.LocalGameEngine = LocalGameEngine;
})(window);
