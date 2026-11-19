"""Catalog of Vitalis creatures and their associated physical exercises."""

from typing import Optional

EXERCISE_MET: dict[str, float] = {
    "Polichinelos": 8.0,
    "Agachamentos": 5.0,
    "Corrida/Caminhada": 7.0,
    "Prancha": 3.8,
}

CREATURES: list[dict] = [
    {
        "id": "voltix",
        "name": "Voltix",
        "type": "Cardio",
        "rarity": "Comum",
        "exercise_type": "Polichinelos",
        "target_reps_or_sec": 15,
        "unit": "reps",
        "xp_reward": 60,
        "calories_est": 15,
        "svg_color": "#FF9800",
        "icon": "bolt",
        "emoji": "bolt",
        "description": "Uma criatura elétrica que recarrega sua energia com saltos rápidos e coordenados.",
    },
    {
        "id": "pulsor",
        "name": "Pulsor",
        "type": "Cardio",
        "rarity": "Incomum",
        "exercise_type": "Corrida/Caminhada",
        "target_reps_or_sec": 30,
        "unit": "seg",
        "xp_reward": 85,
        "calories_est": 25,
        "svg_color": "#F44336",
        "icon": "flame",
        "emoji": "flame",
        "description": "Nascido do ritmo cardíaco acelerado, adora acompanhar corredores ao ar livre.",
    },
    {
        "id": "aerowing",
        "name": "Aerowing",
        "type": "Cardio",
        "rarity": "Raro",
        "exercise_type": "Polichinelos",
        "target_reps_or_sec": 25,
        "unit": "reps",
        "xp_reward": 120,
        "calories_est": 28,
        "svg_color": "#03A9F4",
        "icon": "wind",
        "emoji": "wind",
        "description": "Espírito dos ventos que só aparece para quem mantém o fôlego lá em cima.",
    },
    {
        "id": "ferrodon",
        "name": "Ferrodon",
        "type": "Força",
        "rarity": "Comum",
        "exercise_type": "Agachamentos",
        "target_reps_or_sec": 12,
        "unit": "reps",
        "xp_reward": 65,
        "calories_est": 18,
        "svg_color": "#795548",
        "icon": "layers",
        "emoji": "layers",
        "description": "Guardião das pernas firmes; sua couraça fica mais resistente a cada agachamento.",
    },
    {
        "id": "titanox",
        "name": "Titanox",
        "type": "Força",
        "rarity": "Raro",
        "exercise_type": "Agachamentos",
        "target_reps_or_sec": 20,
        "unit": "reps",
        "xp_reward": 130,
        "calories_est": 32,
        "svg_color": "#607D8B",
        "icon": "shield",
        "emoji": "shield",
        "description": "Colosso de aço que respeita apenas atletas com base sólida e determinação.",
    },
    {
        "id": "brasafor",
        "name": "Brasafor",
        "type": "Força",
        "rarity": "Épico",
        "exercise_type": "Agachamentos",
        "target_reps_or_sec": 30,
        "unit": "reps",
        "xp_reward": 180,
        "calories_est": 45,
        "svg_color": "#D32F2F",
        "icon": "award",
        "emoji": "award",
        "description": "Lendário leão de magma cuja força desperta nos treinos mais intensos.",
    },
    {
        "id": "zephyrin",
        "name": "Zephyrin",
        "type": "Agilidade",
        "rarity": "Comum",
        "exercise_type": "Polichinelos",
        "target_reps_or_sec": 18,
        "unit": "reps",
        "xp_reward": 70,
        "calories_est": 16,
        "svg_color": "#4CAF50",
        "icon": "feather",
        "emoji": "feather",
        "description": "Ágil como uma folha ao vento, desafia seus reflexos e coordenação motora.",
    },
    {
        "id": "velocir",
        "name": "Velocir",
        "type": "Agilidade",
        "rarity": "Incomum",
        "exercise_type": "Corrida/Caminhada",
        "target_reps_or_sec": 45,
        "unit": "seg",
        "xp_reward": 100,
        "calories_est": 30,
        "svg_color": "#00BCD4",
        "icon": "activity",
        "emoji": "activity",
        "description": "Velocista nato das trilhas urbanas, sempre em busca de novos recordes.",
    },
    {
        "id": "relampix",
        "name": "Relampix",
        "type": "Agilidade",
        "rarity": "Épico",
        "exercise_type": "Corrida/Caminhada",
        "target_reps_or_sec": 60,
        "unit": "seg",
        "xp_reward": 190,
        "calories_est": 42,
        "svg_color": "#FFC107",
        "icon": "compass",
        "emoji": "compass",
        "description": "Raposa cintilante que cruza quarteirões inteiros em segundos.",
    },
    {
        "id": "equilibra",
        "name": "Equilibra",
        "type": "Equilíbrio",
        "rarity": "Comum",
        "exercise_type": "Prancha",
        "target_reps_or_sec": 20,
        "unit": "seg",
        "xp_reward": 75,
        "calories_est": 14,
        "svg_color": "#9C27B0",
        "icon": "target",
        "emoji": "target",
        "description": "Criatura serena que fortalece o core e a postura de quem mantém a calma.",
    },
    {
        "id": "lotusaur",
        "name": "Lotusaur",
        "type": "Equilíbrio",
        "rarity": "Incomum",
        "exercise_type": "Prancha",
        "target_reps_or_sec": 35,
        "unit": "seg",
        "xp_reward": 110,
        "calories_est": 22,
        "svg_color": "#E91E63",
        "icon": "droplet",
        "emoji": "droplet",
        "description": "Guardião da estabilidade corporal, floresce quando o abdômen está firme.",
    },
    {
        "id": "zenithon",
        "name": "Zenithon",
        "type": "Equilíbrio",
        "rarity": "Raro",
        "exercise_type": "Prancha",
        "target_reps_or_sec": 50,
        "unit": "seg",
        "xp_reward": 150,
        "calories_est": 30,
        "svg_color": "#3F51B5",
        "icon": "trophy",
        "emoji": "trophy",
        "description": "Dragão contemplativo que testa sua resistência isométrica ao máximo.",
    },
]

_CREATURES_BY_ID: dict[str, dict] = {c["id"]: c for c in CREATURES}


def get_all_creatures() -> list[dict]:
    """Return a copy of all Vitalis creatures in the catalog."""
    return [
        {**c, "met": EXERCISE_MET.get(c["exercise_type"], 5.0)}
        for c in CREATURES
    ]


def get_creature_by_id(creature_id: str) -> Optional[dict]:
    """Return a creature dict by its ID, or None if not found."""
    creature = _CREATURES_BY_ID.get(creature_id)
    if not creature:
        return None
    return {**creature, "met": EXERCISE_MET.get(creature["exercise_type"], 5.0)}


def get_exercise_met(exercise_type: str) -> float:
    """Return the MET value for a given exercise type."""
    return EXERCISE_MET.get(exercise_type, 5.0)
