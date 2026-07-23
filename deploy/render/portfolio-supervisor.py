"""Start the portfolio web and worker processes as one supervised service."""

from __future__ import annotations

import signal
import subprocess
import time
from collections.abc import Sequence

children: list[subprocess.Popen[bytes]] = []
shutting_down = False


def log(message: str) -> None:
    print(f"service=portfolio-supervisor message={message}", flush=True)


def run_startup_step(name: str, command: Sequence[str]) -> None:
    log(f"startup_step_started step={name}")
    result = subprocess.run(command, check=False)
    if result.returncode != 0:
        log(f"startup_step_failed step={name} exit_code={result.returncode}")
        raise SystemExit(result.returncode)
    log(f"startup_step_complete step={name}")


def stop_children() -> None:
    for child in children:
        if child.poll() is None:
            child.terminate()

    deadline = time.monotonic() + 10
    while time.monotonic() < deadline and any(child.poll() is None for child in children):
        time.sleep(0.1)

    for child in children:
        if child.poll() is None:
            child.kill()


def handle_signal(signum: int, _frame: object) -> None:
    global shutting_down
    shutting_down = True
    log(f"shutdown_requested signal={signal.Signals(signum).name}")
    stop_children()


def main() -> None:
    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    run_startup_step("migrations", ["sh", "/scripts/run-migrations.sh"])
    if shutting_down:
        return
    run_startup_step("demo_user", ["sh", "/scripts/seed-demo-user.sh"])
    if shutting_down:
        return

    processes = (
        ("worker", ["python", "-m", "traceframe_worker"]),
        ("web", ["bun", "server.js"]),
    )
    for name, command in processes:
        child = subprocess.Popen(command)
        children.append(child)
        log(f"process_started process={name} pid={child.pid}")

    while True:
        for (name, _command), child in zip(processes, children, strict=True):
            exit_code = child.poll()
            if exit_code is None:
                continue
            if not shutting_down:
                log(f"process_exited process={name} exit_code={exit_code}")
            stop_children()
            raise SystemExit(0 if shutting_down else exit_code or 1)
        time.sleep(0.25)


if __name__ == "__main__":
    main()
