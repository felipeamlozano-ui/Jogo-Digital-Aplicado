"""Threaded HTTP server and JSON REST API for Educação Física Digital."""

from __future__ import annotations

import json
import math
import mimetypes
import random
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Optional
from urllib.parse import parse_qs, urlparse

from backend.creatures import get_all_creatures
from backend.database import (
    DbPath,
    get_fitdex,
    get_leaderboard,
    get_missions,
    get_player,
    init_db,
    record_capture,
    upsert_player,
)

DEFAULT_LAT = -23.5505
DEFAULT_LNG = -46.6333
DEFAULT_STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

# Ensure common web MIME types are registered on Windows
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("application/manifest+json", ".webmanifest")
mimetypes.add_type("application/json", ".json")
mimetypes.add_type("image/svg+xml", ".svg")


def generate_spawns(lat: float, lng: float, count: int = 8) -> list[dict]:
    """Generate deterministic nearby Vitalis spawns around (lat, lng)."""
    # Quantize to ~200m grid and 5-minute window so spawns don't jump every poll
    grid_lat = round(lat, 3)
    grid_lng = round(lng, 3)
    time_bucket = int(time.time() // 300)
    seed = hash((grid_lat, grid_lng, time_bucket))
    rng = random.Random(seed)

    creatures = get_all_creatures()
    cos_lat = max(0.1, math.cos(math.radians(lat)))
    spawns: list[dict] = []

    for idx in range(count):
        creature = rng.choice(creatures)
        # First two spawns are within immediate 60m interaction radius
        if idx < 2:
            dist_m = rng.uniform(18.0, 48.0)
        else:
            dist_m = rng.uniform(55.0, 220.0)
        angle = rng.uniform(0.0, 2.0 * math.pi)

        dlat = (dist_m * math.cos(angle)) / 111320.0
        dlng = (dist_m * math.sin(angle)) / (111320.0 * cos_lat)

        spawns.append(
            {
                "spawn_id": f"sp_{time_bucket}_{idx}_{creature['id']}",
                "creature_id": creature["id"],
                "name": creature["name"],
                "type": creature["type"],
                "rarity": creature["rarity"],
                "exercise_type": creature["exercise_type"],
                "target": creature["target_reps_or_sec"],
                "unit": creature["unit"],
                "xp_reward": creature["xp_reward"],
                "calories_est": creature["calories_est"],
                "met": creature["met"],
                "svg_color": creature["svg_color"],
                "icon": creature["icon"],
                "emoji": creature["emoji"],
                "description": creature["description"],
                "lat": round(lat + dlat, 6),
                "lng": round(lng + dlng, 6),
            }
        )
    return spawns


class VitalisHTTPServer(ThreadingHTTPServer):
    """ThreadingHTTPServer carrying database and static directory config."""

    allow_reuse_address = True
    daemon_threads = True

    def __init__(
        self,
        server_address: tuple[str, int],
        RequestHandlerClass: type[BaseHTTPRequestHandler],
        db_path: DbPath = None,
        static_dir: Optional[Path] = None,
    ) -> None:
        self.db_path = db_path
        self.static_dir = Path(static_dir) if static_dir else DEFAULT_STATIC_DIR
        super().__init__(server_address, RequestHandlerClass)


class VitalisRequestHandler(BaseHTTPRequestHandler):
    """REST API and static file handler."""

    server: VitalisHTTPServer

    def _send_cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send_json(self, payload: Any, status: int = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        try:
            self.send_response(status)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _send_error_json(self, message: str, status: int = HTTPStatus.BAD_REQUEST) -> None:
        self._send_json({"error": message}, status=status)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(HTTPStatus.NO_CONTENT)
        self._send_cors_headers()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path

        if path.startswith("/api/"):
            self._handle_api_get(path, parse_qs(parsed.query))
            return

        self._serve_static(path)

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/api/capture":
            self._handle_capture()
            return
        if parsed.path == "/api/player":
            self._handle_player_post()
            return
        if parsed.path.startswith("/api/"):
            self._send_error_json("Endpoint não encontrado.", HTTPStatus.NOT_FOUND)
            return
        self._send_error_json("Método não permitido.", HTTPStatus.METHOD_NOT_ALLOWED)

    def _read_json_body(self) -> Optional[dict]:
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._send_error_json("Header Content-Length inválido.")
            return None

        if content_length <= 0 or content_length > 1024 * 64:
            self._send_error_json("Corpo da requisição vazio ou muito grande.")
            return None

        raw_body = self.rfile.read(content_length)
        try:
            data = json.loads(raw_body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._send_error_json("JSON inválido.")
            return None

        if not isinstance(data, dict):
            self._send_error_json("O corpo JSON deve ser um objeto.")
            return None
        return data

    def _parse_player_id(self, query: dict[str, list[str]]) -> int:
        raw = query.get("player_id", ["1"])[0]
        return int(raw)

    def _handle_api_get(self, path: str, query: dict[str, list[str]]) -> None:
        db_path = self.server.db_path
        try:
            if path == "/api/player":
                player_id = self._parse_player_id(query)
                self._send_json(get_player(db_path=db_path, player_id=player_id))
                return

            if path == "/api/spawns":
                lat_raw = query.get("lat", [str(DEFAULT_LAT)])[0]
                lng_raw = query.get("lng", [str(DEFAULT_LNG)])[0]
                try:
                    lat = float(lat_raw)
                    lng = float(lng_raw)
                except ValueError:
                    self._send_error_json("Parâmetros 'lat' e 'lng' devem ser numéricos.")
                    return
                if not (-90.0 <= lat <= 90.0 and -180.0 <= lng <= 180.0):
                    self._send_error_json("Coordenadas 'lat'/'lng' fora do intervalo válido.")
                    return
                self._send_json({"spawns": generate_spawns(lat, lng)})
                return

            if path == "/api/fitdex":
                player_id = self._parse_player_id(query)
                self._send_json({"creatures": get_fitdex(db_path=db_path, player_id=player_id)})
                return

            if path == "/api/missions":
                player_id = self._parse_player_id(query)
                self._send_json({"missions": get_missions(db_path=db_path, player_id=player_id)})
                return

            if path == "/api/leaderboard":
                self._send_json({"leaderboard": get_leaderboard(db_path=db_path)})
                return

            self._send_error_json("Endpoint não encontrado.", HTTPStatus.NOT_FOUND)
        except ValueError as exc:
            self._send_error_json(str(exc), HTTPStatus.BAD_REQUEST)
        except Exception as exc:
            self._send_error_json(f"Erro interno: {exc}", HTTPStatus.INTERNAL_SERVER_ERROR)

    def _handle_player_post(self) -> None:
        data = self._read_json_body()
        if data is None:
            return

        username = data.get("username")
        if username is not None and not isinstance(username, str):
            self._send_error_json("Campo 'username' deve ser uma string.")
            return

        weight_kg = data.get("weight_kg")
        if weight_kg is not None:
            try:
                weight_kg = float(weight_kg)
            except (TypeError, ValueError):
                self._send_error_json("Campo 'weight_kg' deve ser numérico.")
                return

        player_id = data.get("player_id")
        if player_id is not None:
            try:
                player_id = int(player_id)
            except (TypeError, ValueError):
                self._send_error_json("Campo 'player_id' deve ser um inteiro.")
                return

        create = bool(data.get("create", False))
        try:
            player = upsert_player(
                username=username,
                weight_kg=weight_kg,
                player_id=player_id,
                create=create,
                db_path=self.server.db_path,
            )
        except ValueError as exc:
            self._send_error_json(str(exc), HTTPStatus.BAD_REQUEST)
            return

        self._send_json(player, status=HTTPStatus.OK)

    def _handle_capture(self) -> None:
        data = self._read_json_body()
        if data is None:
            return

        creature_id = data.get("creature_id")
        if not isinstance(creature_id, str) or not creature_id.strip():
            self._send_error_json("Campo 'creature_id' é obrigatório.")
            return

        exercise_type = str(data.get("exercise_type") or "")
        try:
            duration_sec = float(data.get("duration_sec", 0) or 0)
            distance_m = float(data.get("distance_m", 0) or 0)
            reps = int(data.get("reps", 0) or 0)
            player_id = int(data.get("player_id", 1) or 1)
        except (TypeError, ValueError):
            self._send_error_json("Campos numéricos inválidos.")
            return

        if duration_sec < 0 or distance_m < 0 or reps < 0:
            self._send_error_json("Valores de exercício não podem ser negativos.")
            return

        try:
            result = record_capture(
                creature_id=creature_id.strip(),
                exercise_type=exercise_type,
                duration_sec=duration_sec,
                distance_m=distance_m,
                reps=reps,
                db_path=self.server.db_path,
                player_id=player_id,
            )
        except ValueError as exc:
            self._send_error_json(str(exc), HTTPStatus.BAD_REQUEST)
            return

        self._send_json(result, status=HTTPStatus.OK)

    def _serve_static(self, req_path: str) -> None:
        static_root = self.server.static_dir.resolve()
        rel_path = "index.html" if req_path in ("", "/") else req_path.lstrip("/")
        target = (static_root / rel_path).resolve()

        # Prevent directory traversal outside static/
        if static_root not in target.parents and target != static_root:
            self._send_error_json("Acesso negado.", HTTPStatus.FORBIDDEN)
            return

        if target.is_dir():
            target = target / "index.html"

        if not target.is_file():
            self._send_error_json("Arquivo não encontrado.", HTTPStatus.NOT_FOUND)
            return

        mime_type, _ = mimetypes.guess_type(str(target))
        if not mime_type:
            mime_type = "application/octet-stream"
        if mime_type.startswith("text/") or mime_type in (
            "application/javascript",
            "application/json",
        ):
            mime_type = f"{mime_type}; charset=utf-8"

        data = target.read_bytes()
        try:
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", mime_type)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def log_message(self, format: str, *args: Any) -> None:
        """Keep server logs concise."""
        return


def create_server(
    host: str = "0.0.0.0",
    port: int = 8000,
    db_path: DbPath = None,
    static_dir: Optional[Path] = None,
) -> VitalisHTTPServer:
    """Initialize SQLite database and create a configured VitalisHTTPServer."""
    init_db(db_path=db_path)
    return VitalisHTTPServer(
        (host, port),
        VitalisRequestHandler,
        db_path=db_path,
        static_dir=static_dir,
    )
