(function (global) {
  'use strict';

  const STORAGE_KEY = 'vitalis_local_state_v2';

  const CREATURES = [
    {
      id: 'voltix',
      name: 'Voltix',
      type: 'Cardio',
      rarity: 'Comum',
      exercise_type: 'Polichinelos',
      target_reps_or_sec: 15,
      unit: 'reps',
      xp_reward: 60,
      calories_est: 15,
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
      target_reps_or_sec: 30,
      unit: 'seg',
      xp_reward: 85,
      calories_est: 25,
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
      target_reps_or_sec: 25,
      unit: 'reps',
      xp_reward: 120,
      calories_est: 28,
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
      target_reps_or_sec: 12,
      unit: 'reps',
      xp_reward: 65,
      calories_est: 18,
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
      target_reps_or_sec: 20,
      unit: 'reps',
      xp_reward: 130,
      calories_est: 32,
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
      target_reps_or_sec: 30,
      unit: 'reps',
      xp_reward: 180,
      calories_est: 45,
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
      target_reps_or_sec: 18,
      unit: 'reps',
      xp_reward: 70,
      calories_est: 16,
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
      target_reps_or_sec: 45,
      unit: 'seg',
      xp_reward: 100,
      calories_est: 30,
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
      target_reps_or_sec: 60,
      unit: 'seg',
      xp_reward: 190,
      calories_est: 42,
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
      target_reps_or_sec: 20,
      unit: 'seg',
      xp_reward: 75,
      calories_est: 14,
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
      target_reps_or_sec: 35,
      unit: 'seg',
      xp_reward: 110,
      calories_est: 22,
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
      target_reps_or_sec: 50,
      unit: 'seg',
      xp_reward: 150,
      calories_est: 30,
      svg_color: '#4F46E5',
      icon: 'compass',
      description: 'Dragão contemplativo que testa resistência isométrica ao máximo.'
    }
  ];

  const NPC_PLAYERS = [
    { username: 'CorredoraAna', level: 4, xp: 180, total_exercises: 24 },
    { username: 'AtletaLucas', level: 3, xp: 90, total_exercises: 16 },
    { username: 'FitMariana', level: 2, xp: 120, total_exercises: 9 },
    { username: 'RunnerPedro', level: 1, xp: 75, total_exercises: 4 }
  ];

  function loadState() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.player) return parsed;
      }
    } catch (_) {}

    return {
      player: {
        id: 1,
        username: 'AtletaVitalis',
        level: 1,
        xp: 0,
        total_distance_m: 0,
        total_calories: 0,
        total_exercises: 0
      },
      captures: {}
    };
  }

  function saveState(state) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {}
  }

  function computeBadges(player, captures) {
    const badges = [];
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

  function buildPlayerResponse(state) {
    const p = state.player;
    return {
      id: p.id,
      username: p.username,
      level: p.level,
      xp: p.xp,
      next_level_xp: p.level * 100,
      total_distance_m: Math.round(p.total_distance_m),
      total_calories: Math.round(p.total_calories),
      total_exercises: p.total_exercises,
      badges: computeBadges(p, state.captures)
    };
  }

  const LocalGameEngine = {
    getPlayer() {
      const state = loadState();
      return buildPlayerResponse(state);
    },

    getSpawns(lat, lng) {
      const baseLat = Number(lat) || -23.587416;
      const baseLng = Number(lng) || -46.657634;
      const cosLat = Math.cos((baseLat * Math.PI) / 180) || 1;
      const spawns = [];
      const count = 8;

      for (let i = 0; i < count; i++) {
        const creature = CREATURES[Math.floor(Math.random() * CREATURES.length)];
        // First 2 within interaction range (25-48m), remaining spread cleanly 55-180m
        const distM = i < 2 ? 25 + i * 12 + Math.random() * 10 : 55 + ((i - 2) / (count - 2)) * 115 + Math.random() * 12;
        // Distribute angles evenly around the compass with slight jitter so spawns never stack
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
          target: creature.target_reps_or_sec,
          unit: creature.unit,
          xp_reward: creature.xp_reward,
          calories_est: creature.calories_est,
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
      const creature = CREATURES.find((c) => c.id === body.creature_id) || CREATURES[0];
      const xpGained = creature.xp_reward;
      const caloriesBurned = creature.calories_est;
      const distM = Math.max(0, Number(body.distance_m) || 0);

      const p = state.player;
      p.total_exercises += 1;
      p.total_distance_m += distM;
      p.total_calories += caloriesBurned;
      p.xp += xpGained;

      let leveledUp = false;
      while (p.xp >= p.level * 100) {
        p.xp -= p.level * 100;
        p.level += 1;
        leveledUp = true;
      }

      if (!state.captures[creature.id]) {
        state.captures[creature.id] = {
          count: 1,
          first_captured_at: new Date().toISOString()
        };
      } else {
        state.captures[creature.id].count += 1;
      }

      saveState(state);
      return {
        captured: true,
        creature,
        xp_gained: xpGained,
        calories_burned: caloriesBurned,
        leveled_up: leveledUp,
        player: buildPlayerResponse(state)
      };
    },

    getFitdex() {
      const state = loadState();
      return {
        creatures: CREATURES.map((c) => {
          const cap = state.captures[c.id];
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
      const p = state.player;
      const uniqueCount = Object.keys(state.captures).length;
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
      const p = state.player;
      const all = [
        ...NPC_PLAYERS,
        {
          username: p.username,
          level: p.level,
          xp: p.xp,
          total_exercises: p.total_exercises
        }
      ];
      all.sort((a, b) => (b.level - a.level) || (b.xp - a.xp) || (b.total_exercises - a.total_exercises));
      return {
        leaderboard: all.map((entry, idx) => ({
          rank: idx + 1,
          ...entry
        }))
      };
    }
  };

  global.LocalGameEngine = LocalGameEngine;
})(window);
