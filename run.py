import os
import socket
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

import uvicorn


def find_available_port(start_port: int = 8000, max_attempts: int = 20) -> int:
    env_port = os.environ.get("PORT")
    if env_port:
        try:
            return int(env_port)
        except ValueError:
            pass

    for port in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    return start_port


def wait_and_open_browser(url: str, timeout: float = 10.0) -> None:
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            with urllib.request.urlopen(url, timeout=0.5) as response:
                if response.status == 200:
                    webbrowser.open(url)
                    return
        except Exception:
            time.sleep(0.2)
    webbrowser.open(url)


if __name__ == "__main__":
    current_dir = Path(__file__).resolve().parent
    port = find_available_port(8100)
    url = f"http://127.0.0.1:{port}"

    print("==================================================")
    print(f"Каталог запуска: {current_dir}")
    if port != 8100:
        print(f"Порт 8100 занят (возможно, запущена другая версия).")
        print(f"Эта копия запущена на свободном порту {port}: {url}")
    else:
        print(f"Приложение запущено: {url}")
    print("==================================================")

    threading.Thread(target=wait_and_open_browser, args=(url,), daemon=True).start()
    uvicorn.run("medflow.main:app", host="127.0.0.1", port=port, reload=False)
