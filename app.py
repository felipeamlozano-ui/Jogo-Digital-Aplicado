"""Entry point for Educação Física Digital (Vitalis GO)."""

from __future__ import annotations

import os
import sys

from backend.server import create_server


def main() -> None:
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8000"))

    server = create_server(host=host, port=port)
    print(f"Educacao Fisica Digital (Vitalis GO) rodando em http://localhost:{port}")
    print("Pressione Ctrl+C para encerrar.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor encerrado.")
    finally:
        server.server_close()


if __name__ == "__main__":
    try:
        main()
    except OSError as exc:
        print(f"Erro ao iniciar servidor: {exc}", file=sys.stderr)
        sys.exit(1)
