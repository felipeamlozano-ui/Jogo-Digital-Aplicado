"""Unit and integration tests for Educação Física Digital (Vitalis GO)."""

from __future__ import annotations

import json
import math
import sqlite3
import tempfile
import threading
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from backend.creatures import get_all_creatures
from backend.database import (
    get_fitdex,
    get_leaderboard,
    get_missions,
    get_player,
    init_db,
    record_capture,
    xp_for_next_level,
)
from backend.server import create_server, generate_spawns


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Return great-circle distance in meters between two WGS84 coordinates."""
    r = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = (
        math.sin(dphi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    )
    return 2.0 * r * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


class DatabaseAndLogicTests(unittest.TestCase):
    """Unit tests for SQLite initialization, XP/level-up math, and spawn generation."""

    def setUp(self) -> None:
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.tmp_dir.name) / "test_vitalis.db"
        init_db(self.db_path)

    def tearDown(self) -> None:
        self.tmp_dir.cleanup()

    def test_database_initialization_tables_and_seed(self) -> None:
        conn = sqlite3.connect(str(self.db_path))
        try:
            tables = {
                row[0]
                for row in conn.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                ).fetchall()
            }
            self.assertTrue({"players", "captures", "activity_logs"}.issubset(tables))

            players = conn.execute("SELECT id, username FROM players ORDER BY id").fetchall()
            self.assertEqual(len(players), 5)
            self.assertEqual(players[0], (1, "AtletaVitalis"))
        finally:
            conn.close()

        # Calling init_db again must be idempotent
        init_db(self.db_path)
        player = get_player(self.db_path)
        self.assertEqual(player["id"], 1)
        self.assertEqual(player["username"], "AtletaVitalis")
        self.assertEqual(player["level"], 1)
        self.assertEqual(player["xp"], 0)
        self.assertEqual(player["next_level_xp"], 100)

    def test_xp_and_level_up_math(self) -> None:
        self.assertEqual(xp_for_next_level(1), 100)
        self.assertEqual(xp_for_next_level(2), 200)
        self.assertEqual(xp_for_next_level(5), 500)

        # Voltix gives 60 XP base; 15 reps == target -> no effort bonus -> 60 XP, stays level 1
        res1 = record_capture(
            creature_id="voltix",
            exercise_type="Polichinelos",
            duration_sec=20.0,
            distance_m=0.0,
            reps=15,
            db_path=self.db_path,
        )
        self.assertTrue(res1["captured"])
        self.assertEqual(res1["xp_gained"], 60)
        self.assertFalse(res1["leveled_up"])
        self.assertEqual(res1["player"]["level"], 1)
        self.assertEqual(res1["player"]["xp"], 60)
        self.assertEqual(res1["player"]["total_exercises"], 1)
        badge_ids = {b["id"] for b in res1["player"]["badges"]}
        self.assertIn("first_step", badge_ids)

        # Brasafor gives 180 XP base; 60 + 180 = 240 >= 100 -> level 2 with 140 XP (< 200)
        res2 = record_capture(
            creature_id="brasafor",
            exercise_type="Agachamentos",
            duration_sec=45.0,
            distance_m=100.0,
            reps=30,
            db_path=self.db_path,
        )
        self.assertTrue(res2["leveled_up"])
        self.assertEqual(res2["player"]["level"], 2)
        self.assertEqual(res2["player"]["xp"], 140)
        self.assertEqual(res2["player"]["next_level_xp"], 200)
        self.assertEqual(res2["player"]["total_distance_m"], 100.0)

        # Effort bonus test: Relampix (target 60 seg, xp_reward 190).
        # 80 seg -> (80 - 60) // 2 = +10 bonus -> 200 XP.
        # 140 + 200 = 340 >= 200 -> level 3 with 140 XP.
        res3 = record_capture(
            creature_id="relampix",
            exercise_type="Corrida/Caminhada",
            duration_sec=80.0,
            distance_m=500.0,
            reps=0,
            db_path=self.db_path,
        )
        self.assertEqual(res3["xp_gained"], 200)
        self.assertTrue(res3["leveled_up"])
        self.assertEqual(res3["player"]["level"], 3)
        self.assertEqual(res3["player"]["xp"], 140)

    def test_spawn_generation(self) -> None:
        base_lat, base_lng = -23.5505, -46.6333
        spawns = generate_spawns(base_lat, base_lng, count=8)
        self.assertEqual(len(spawns), 8)

        required_keys = {
            "spawn_id",
            "creature_id",
            "name",
            "type",
            "rarity",
            "exercise_type",
            "target",
            "unit",
            "xp_reward",
            "lat",
            "lng",
        }
        creature_ids = {c["id"] for c in get_all_creatures()}

        for idx, sp in enumerate(spawns):
            self.assertTrue(required_keys.issubset(sp.keys()))
            self.assertIn(sp["creature_id"], creature_ids)
            dist = haversine_m(base_lat, base_lng, sp["lat"], sp["lng"])
            if idx < 2:
                self.assertLessEqual(dist, 60.0)
            else:
                self.assertLessEqual(dist, 260.0)

        # Deterministic for same coordinates within the same 5-min bucket
        spawns_again = generate_spawns(base_lat, base_lng, count=8)
        self.assertEqual(
            [s["spawn_id"] for s in spawns],
            [s["spawn_id"] for s in spawns_again],
        )


class ApiIntegrationTests(unittest.TestCase):
    """HTTP integration tests against VitalisHTTPServer with a temporary SQLite DB."""

    def setUp(self) -> None:
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.tmp_dir.name) / "api_test.db"
        self.project_root = Path(__file__).resolve().parent.parent
        self.server = create_server(
            host="127.0.0.1",
            port=0,
            db_path=self.db_path,
            static_dir=self.project_root / "static",
        )
        self.port = self.server.server_address[1]
        self.base_url = f"http://127.0.0.1:{self.port}"
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2.0)
        self.tmp_dir.cleanup()

    def _get_json(self, path: str) -> tuple[int, dict]:
        with urlopen(f"{self.base_url}{path}", timeout=5) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))

    def _post_json(self, path: str, payload: dict) -> tuple[int, dict]:
        data = json.dumps(payload).encode("utf-8")
        req = Request(
            f"{self.base_url}{path}",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(req, timeout=5) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))

    def test_get_player(self) -> None:
        status, data = self._get_json("/api/player")
        self.assertEqual(status, 200)
        self.assertEqual(data["username"], "AtletaVitalis")
        self.assertEqual(data["level"], 1)
        self.assertEqual(data["xp"], 0)
        self.assertEqual(data["next_level_xp"], 100)
        self.assertIn("badges", data)
        self.assertIsInstance(data["badges"], list)

    def test_get_spawns_and_validation(self) -> None:
        status, data = self._get_json("/api/spawns?lat=-23.5505&lng=-46.6333")
        self.assertEqual(status, 200)
        self.assertIn("spawns", data)
        self.assertEqual(len(data["spawns"]), 8)

        with self.assertRaises(HTTPError) as ctx:
            self._get_json("/api/spawns?lat=abc&lng=-46.6333")
        self.assertEqual(ctx.exception.code, 400)

    def test_post_capture_updates_fitdex_missions_and_leaderboard(self) -> None:
        # 1. Capture a creature
        status, cap = self._post_json(
            "/api/capture",
            {
                "creature_id": "voltix",
                "exercise_type": "Polichinelos",
                "duration_sec": 25,
                "distance_m": 120,
                "reps": 18,
            },
        )
        self.assertEqual(status, 200)
        self.assertTrue(cap["captured"])
        self.assertEqual(cap["creature"]["id"], "voltix")
        self.assertGreater(cap["xp_gained"], 0)
        self.assertEqual(cap["player"]["total_exercises"], 1)

        # 2. Check FitDex
        status, fitdex = self._get_json("/api/fitdex")
        self.assertEqual(status, 200)
        self.assertIn("creatures", fitdex)
        voltix = next(c for c in fitdex["creatures"] if c["id"] == "voltix")
        self.assertEqual(voltix["captured_count"], 1)
        self.assertIsNotNone(voltix["first_captured_at"])

        # 3. Check Missions
        status, missions = self._get_json("/api/missions")
        self.assertEqual(status, 200)
        self.assertIn("missions", missions)
        self.assertGreaterEqual(len(missions["missions"]), 1)
        for m in missions["missions"]:
            for key in ("id", "title", "description", "target", "progress", "unit", "completed", "xp_reward"):
                self.assertIn(key, m)

        # 4. Check Leaderboard
        status, lb = self._get_json("/api/leaderboard")
        self.assertEqual(status, 200)
        self.assertIn("leaderboard", lb)
        self.assertGreaterEqual(len(lb["leaderboard"]), 5)
        self.assertEqual(lb["leaderboard"][0]["rank"], 1)
        names = [entry["username"] for entry in lb["leaderboard"]]
        self.assertIn("AtletaVitalis", names)

    def test_post_capture_validation_errors(self) -> None:
        with self.assertRaises(HTTPError) as ctx:
            self._post_json(
                "/api/capture",
                {
                    "creature_id": "nonexistent_creature",
                    "exercise_type": "Polichinelos",
                    "duration_sec": 10,
                    "distance_m": 0,
                    "reps": 10,
                },
            )
        self.assertEqual(ctx.exception.code, 400)

        with self.assertRaises(HTTPError) as ctx2:
            self._post_json(
                "/api/capture",
                {
                    "creature_id": "voltix",
                    "exercise_type": "Polichinelos",
                    "duration_sec": -5,
                    "distance_m": 0,
                    "reps": 10,
                },
            )
        self.assertEqual(ctx2.exception.code, 400)

    def test_static_assets_served(self) -> None:
        static_paths = [
            ("/", "./js/local_engine.js"),
            ("/css/style.css", "body"),
            ("/js/sensors.js", "SoundFX"),
            ("/js/map.js", "VitalisMap"),
            ("/js/local_engine.js", "LocalGameEngine"),
            ("/js/game.js", "./api/capture"),
            ("/manifest.json", "./"),
            ("/sw.js", "addEventListener"),
        ]
        for path, expected_substr in static_paths:
            with self.subTest(path=path):
                with urlopen(f"{self.base_url}{path}", timeout=5) as resp:
                    self.assertEqual(resp.status, 200)
                    body = resp.read().decode("utf-8")
                    self.assertIn(expected_substr, body)

    def test_no_emojis_in_api_responses(self) -> None:
        self._post_json(
            "/api/capture",
            {
                "creature_id": "voltix",
                "exercise_type": "Polichinelos",
                "duration_sec": 20,
                "distance_m": 0,
                "reps": 15,
            },
        )
        for endpoint in (
            "/api/player",
            "/api/spawns?lat=-23.5505&lng=-46.6333",
            "/api/fitdex",
            "/api/missions",
            "/api/leaderboard",
        ):
            _, data = self._get_json(endpoint)
            serialized = json.dumps(data, ensure_ascii=False)
            bad = [c for c in serialized if ord(c) > 0x024F]
            self.assertEqual(bad, [], f"Unexpected non-Latin/emoji chars in {endpoint}: {bad}")


if __name__ == "__main__":
    unittest.main()
