"""SQLite database layer for Educação Física Digital (Vitalis GO)."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Union

from backend.creatures import get_all_creatures, get_creature_by_id, get_exercise_met

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "vitalis.db"

DbPath = Optional[Union[str, Path]]


def _resolve_db_path(db_path: DbPath = None) -> Path:
    if db_path is None:
        return DEFAULT_DB_PATH
    return Path(db_path)


def get_connection(db_path: DbPath = None) -> sqlite3.Connection:
    """Open a SQLite connection with Row factory enabled."""
    resolved = _resolve_db_path(db_path)
    resolved.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(resolved), timeout=10.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def xp_for_next_level(level: int) -> int:
    """Return the XP required to advance from `level` to `level + 1`."""
    return max(1, level) * 100


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def init_db(db_path: DbPath = None) -> None:
    """Create tables if needed and seed the default real player (no fake NPCs)."""
    conn = get_connection(db_path)
    try:
        with conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS players (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    level INTEGER NOT NULL DEFAULT 1,
                    xp INTEGER NOT NULL DEFAULT 0,
                    weight_kg REAL NOT NULL DEFAULT 70.0,
                    total_distance_m REAL NOT NULL DEFAULT 0.0,
                    total_calories REAL NOT NULL DEFAULT 0.0,
                    total_exercises INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS captures (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    player_id INTEGER NOT NULL,
                    creature_id TEXT NOT NULL,
                    captured_at TEXT NOT NULL,
                    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS activity_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    player_id INTEGER NOT NULL,
                    creature_id TEXT,
                    exercise_type TEXT NOT NULL,
                    duration_sec REAL NOT NULL DEFAULT 0.0,
                    distance_m REAL NOT NULL DEFAULT 0.0,
                    reps INTEGER NOT NULL DEFAULT 0,
                    xp_gained INTEGER NOT NULL DEFAULT 0,
                    calories_burned REAL NOT NULL DEFAULT 0.0,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
                );
                """
            )

            # Safe migration for existing databases lacking weight_kg
            cols = [r[1] for r in conn.execute("PRAGMA table_info(players)").fetchall()]
            if "weight_kg" not in cols:
                conn.execute("ALTER TABLE players ADD COLUMN weight_kg REAL NOT NULL DEFAULT 70.0")

            count = conn.execute("SELECT COUNT(*) FROM players").fetchone()[0]
            if count == 0:
                now = _now_iso()
                # Primary active real player (id = 1)
                conn.execute(
                    """
                    INSERT INTO players (username, level, xp, weight_kg, total_distance_m, total_calories, total_exercises, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    ("AtletaVitalis", 1, 0, 70.0, 0.0, 0.0, 0, now),
                )
    finally:
        conn.close()


def _compute_badges(conn: sqlite3.Connection, player_row: sqlite3.Row) -> list[dict]:
    """Compute earned badges for a player."""
    unique_captures = conn.execute(
        "SELECT COUNT(DISTINCT creature_id) FROM captures WHERE player_id = ?",
        (player_row["id"],),
    ).fetchone()[0]

    badges: list[dict] = []
    if player_row["total_exercises"] >= 1:
        badges.append(
            {
                "id": "first_step",
                "name": "Primeiro Passo",
                "icon": "activity",
                "description": "Completou seu primeiro exercício físico.",
            }
        )
    if unique_captures >= 3:
        badges.append(
            {
                "id": "collector_3",
                "name": "Colecionador Iniciante",
                "icon": "compass",
                "description": "Capturou 3 espécies diferentes de Vitalis.",
            }
        )
    if unique_captures >= 8:
        badges.append(
            {
                "id": "vitalis_master",
                "name": "Mestre Vitalis",
                "icon": "trophy",
                "description": "Capturou 8 espécies diferentes de Vitalis.",
            }
        )
    if player_row["total_distance_m"] >= 1000:
        badges.append(
            {
                "id": "marathoner",
                "name": "Explorador 1K",
                "icon": "target",
                "description": "Percorreu pelo menos 1.000 metros.",
            }
        )
    if player_row["total_calories"] >= 100:
        badges.append(
            {
                "id": "calorie_burner",
                "name": "Energia Pura",
                "icon": "flame",
                "description": "Queimou 100 kcal ou mais em atividades.",
            }
        )
    if player_row["level"] >= 5:
        badges.append(
            {
                "id": "level_5",
                "name": "Atleta Nível 5",
                "icon": "award",
                "description": "Alcançou o nível 5 de condicionamento.",
            }
        )
    return badges


def _format_player(conn: sqlite3.Connection, row: sqlite3.Row) -> dict:
    weight = float(row["weight_kg"]) if "weight_kg" in row.keys() and row["weight_kg"] else 70.0
    return {
        "id": row["id"],
        "username": row["username"],
        "level": row["level"],
        "xp": row["xp"],
        "next_level_xp": xp_for_next_level(row["level"]),
        "weight_kg": round(weight, 1),
        "total_distance_m": round(float(row["total_distance_m"]), 1),
        "total_calories": round(float(row["total_calories"]), 1),
        "total_exercises": int(row["total_exercises"]),
        "badges": _compute_badges(conn, row),
    }


def get_player(db_path: DbPath = None, player_id: int = 1) -> dict:
    """Fetch the active player's profile and badges."""
    conn = get_connection(db_path)
    try:
        row = conn.execute("SELECT * FROM players WHERE id = ?", (player_id,)).fetchone()
        if row is None:
            raise ValueError(f"Player {player_id} not found")
        return _format_player(conn, row)
    finally:
        conn.close()


def upsert_player(
    username: Optional[str] = None,
    weight_kg: Optional[float] = None,
    player_id: Optional[int] = None,
    create: bool = False,
    db_path: DbPath = None,
) -> dict:
    """Update an existing player profile or create a new real player."""
    if weight_kg is not None:
        weight_kg = float(weight_kg)
        if weight_kg <= 0 or weight_kg > 500:
            raise ValueError("weight_kg deve estar entre 1 e 500.")

    if username is not None:
        username = username.strip()
        if not username:
            raise ValueError("username não pode ser vazio.")
        username = username[:40]

    conn = get_connection(db_path)
    try:
        with conn:
            if create:
                if not username:
                    raise ValueError("username é obrigatório para criar um novo atleta.")
                existing = conn.execute(
                    "SELECT * FROM players WHERE username = ?", (username,)
                ).fetchone()
                if existing is not None:
                    return _format_player(conn, existing)
                now = _now_iso()
                w = weight_kg if weight_kg is not None else 70.0
                cur = conn.execute(
                    """
                    INSERT INTO players (username, level, xp, weight_kg, total_distance_m, total_calories, total_exercises, created_at)
                    VALUES (?, 1, 0, ?, 0.0, 0.0, 0, ?)
                    """,
                    (username, w, now),
                )
                new_row = conn.execute(
                    "SELECT * FROM players WHERE id = ?", (cur.lastrowid,)
                ).fetchone()
                return _format_player(conn, new_row)

            target_id = int(player_id) if player_id is not None else 1
            row = conn.execute("SELECT * FROM players WHERE id = ?", (target_id,)).fetchone()
            if row is None:
                raise ValueError(f"Player {target_id} not found")

            new_username = username if username is not None else row["username"]
            new_weight = weight_kg if weight_kg is not None else float(row["weight_kg"] or 70.0)
            conn.execute(
                "UPDATE players SET username = ?, weight_kg = ? WHERE id = ?",
                (new_username, new_weight, target_id),
            )
            updated = conn.execute("SELECT * FROM players WHERE id = ?", (target_id,)).fetchone()
            return _format_player(conn, updated)
    finally:
        conn.close()


def record_capture(
    creature_id: str,
    exercise_type: str,
    duration_sec: float = 0.0,
    distance_m: float = 0.0,
    reps: int = 0,
    db_path: DbPath = None,
    player_id: int = 1,
) -> dict:
    """Validate creature, log capture & activity, update player stats, and return result."""
    creature = get_creature_by_id(creature_id)
    if creature is None:
        raise ValueError(f"Unknown creature_id: {creature_id}")

    xp_gained = int(creature["xp_reward"])
    # Small effort bonus if user exceeded target reps/sec
    target = int(creature["target_reps_or_sec"])
    effort = reps if creature["unit"] == "reps" else duration_sec
    if effort > target:
        xp_gained += min(30, int((effort - target) // 2))

    ex_type = exercise_type or creature["exercise_type"]
    met = float(get_exercise_met(ex_type))
    effective_duration_sec = (
        max(float(duration_sec), float(reps) * 2.0) if reps > 0 else float(duration_sec)
    )

    now = _now_iso()
    conn = get_connection(db_path)
    try:
        with conn:
            row = conn.execute("SELECT * FROM players WHERE id = ?", (player_id,)).fetchone()
            if row is None:
                raise ValueError(f"Player {player_id} not found")

            weight_kg = float(row["weight_kg"]) if row["weight_kg"] else 70.0
            kcal = (met * 3.5 * weight_kg / 200.0) * (effective_duration_sec / 60.0)
            if float(distance_m) > 0 and ex_type != "Corrida/Caminhada":
                walking_sec = float(distance_m) / 1.4
                kcal += (3.5 * 3.5 * weight_kg / 200.0) * (walking_sec / 60.0)
            calories_burned = round(kcal, 1)

            conn.execute(
                "INSERT INTO captures (player_id, creature_id, captured_at) VALUES (?, ?, ?)",
                (player_id, creature_id, now),
            )
            conn.execute(
                """
                INSERT INTO activity_logs
                    (player_id, creature_id, exercise_type, duration_sec, distance_m, reps, xp_gained, calories_burned, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    player_id,
                    creature_id,
                    ex_type,
                    float(duration_sec),
                    float(distance_m),
                    int(reps),
                    xp_gained,
                    calories_burned,
                    now,
                ),
            )

            old_level = int(row["level"])
            new_level = old_level
            new_xp = int(row["xp"]) + xp_gained
            while new_xp >= xp_for_next_level(new_level):
                new_xp -= xp_for_next_level(new_level)
                new_level += 1

            leveled_up = new_level > old_level
            new_distance = float(row["total_distance_m"]) + float(distance_m)
            new_calories = float(row["total_calories"]) + calories_burned
            new_exercises = int(row["total_exercises"]) + 1

            conn.execute(
                """
                UPDATE players
                SET level = ?, xp = ?, total_distance_m = ?, total_calories = ?, total_exercises = ?
                WHERE id = ?
                """,
                (new_level, new_xp, new_distance, new_calories, new_exercises, player_id),
            )

            updated_row = conn.execute("SELECT * FROM players WHERE id = ?", (player_id,)).fetchone()
            player_data = _format_player(conn, updated_row)

        return {
            "captured": True,
            "creature": creature,
            "xp_gained": xp_gained,
            "calories_burned": calories_burned,
            "leveled_up": leveled_up,
            "player": player_data,
        }
    finally:
        conn.close()


def get_fitdex(db_path: DbPath = None, player_id: int = 1) -> list[dict]:
    """Return all Vitalis creatures with capture counts and first capture timestamp."""
    conn = get_connection(db_path)
    try:
        rows = conn.execute(
            """
            SELECT creature_id, COUNT(*) AS captured_count, MIN(captured_at) AS first_captured_at
            FROM captures
            WHERE player_id = ?
            GROUP BY creature_id
            """,
            (player_id,),
        ).fetchall()
        capture_map = {
            r["creature_id"]: {
                "captured_count": int(r["captured_count"]),
                "first_captured_at": r["first_captured_at"],
            }
            for r in rows
        }

        result: list[dict] = []
        for creature in get_all_creatures():
            stats = capture_map.get(
                creature["id"], {"captured_count": 0, "first_captured_at": None}
            )
            entry = dict(creature)
            entry["captured_count"] = stats["captured_count"]
            entry["first_captured_at"] = stats["first_captured_at"]
            result.append(entry)
        return result
    finally:
        conn.close()


def get_missions(db_path: DbPath = None, player_id: int = 1) -> list[dict]:
    """Return player missions with live progress computed from stats and captures."""
    conn = get_connection(db_path)
    try:
        player = conn.execute("SELECT * FROM players WHERE id = ?", (player_id,)).fetchone()
        if player is None:
            raise ValueError(f"Player {player_id} not found")

        total_captures = conn.execute(
            "SELECT COUNT(*) FROM captures WHERE player_id = ?", (player_id,)
        ).fetchone()[0]

        captured_ids = [
            r["creature_id"]
            for r in conn.execute(
                "SELECT DISTINCT creature_id FROM captures WHERE player_id = ?", (player_id,)
            ).fetchall()
        ]
        captured_types = {
            c["type"]
            for cid in captured_ids
            if (c := get_creature_by_id(cid)) is not None
        }

        exercises = int(player["total_exercises"])
        distance = round(float(player["total_distance_m"]), 1)
        calories = round(float(player["total_calories"]), 1)
        types_count = len(captured_types)

        missions = [
            {
                "id": "m_exercises_3",
                "title": "Aquecimento Diário",
                "description": "Complete 3 exercícios físicos para despertar sua energia.",
                "target": 3,
                "progress": min(exercises, 3),
                "unit": "exercícios",
                "completed": exercises >= 3,
                "xp_reward": 100,
            },
            {
                "id": "m_captures_5",
                "title": "Caçador Vitalis",
                "description": "Capture 5 criaturas Vitalis no mapa.",
                "target": 5,
                "progress": min(int(total_captures), 5),
                "unit": "capturas",
                "completed": total_captures >= 5,
                "xp_reward": 150,
            },
            {
                "id": "m_distance_500",
                "title": "Caminhada Ativa",
                "description": "Percorra 500 metros explorando a cidade.",
                "target": 500,
                "progress": min(distance, 500),
                "unit": "m",
                "completed": distance >= 500,
                "xp_reward": 120,
            },
            {
                "id": "m_calories_100",
                "title": "Energia Total",
                "description": "Queime 100 kcal em atividades físicas.",
                "target": 100,
                "progress": min(calories, 100),
                "unit": "kcal",
                "completed": calories >= 100,
                "xp_reward": 150,
            },
            {
                "id": "m_types_4",
                "title": "Equilíbrio Completo",
                "description": "Capture criaturas dos 4 tipos (Cardio, Força, Agilidade e Equilíbrio).",
                "target": 4,
                "progress": min(types_count, 4),
                "unit": "tipos",
                "completed": types_count >= 4,
                "xp_reward": 200,
            },
        ]
        return missions
    finally:
        conn.close()


def get_leaderboard(db_path: DbPath = None, limit: int = 10) -> list[dict]:
    """Return top real players ordered by level, XP, and total calories."""
    conn = get_connection(db_path)
    try:
        rows = conn.execute(
            """
            SELECT id, username, level, xp, total_calories, total_exercises
            FROM players
            ORDER BY level DESC, xp DESC, total_calories DESC, id ASC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        return [
            {
                "rank": idx + 1,
                "id": int(r["id"]),
                "username": r["username"],
                "level": int(r["level"]),
                "xp": int(r["xp"]),
                "total_calories": round(float(r["total_calories"]), 1),
                "total_exercises": int(r["total_exercises"]),
            }
            for idx, r in enumerate(rows)
        ]
    finally:
        conn.close()
