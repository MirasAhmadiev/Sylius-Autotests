#!/usr/bin/env bash
set -euo pipefail

# DISPLAY можно переопределить через env, по умолчанию :99
export DISPLAY="${DISPLAY:-:99}"

# Готовим /tmp/.X11-unix: под root выставим 1777, под обычным просто убедимся что есть
if [ "$(id -u)" = "0" ]; then
  mkdir -p /tmp/.X11-unix
  chmod 1777 /tmp/.X11-unix
else
  mkdir -p /tmp/.X11-unix || true
fi

# Стартуем Xvfb/WM/VNC, если ещё не запущены
pgrep -x Xvfb    >/dev/null 2>&1 || Xvfb "$DISPLAY" -screen 0 1920x1080x24 -nolisten tcp -ac +extension RANDR >/tmp/xvfb.log 2>&1 &
pgrep -x fluxbox >/dev/null 2>&1 || fluxbox >/tmp/fluxbox.log 2>&1 &
pgrep -f "x11vnc.*${DISPLAY}" >/dev/null 2>&1 || x11vnc -display "$DISPLAY" -forever -shared -nopw -rfbport 5900 -quiet >/tmp/x11vnc.log 2>&1 &

sleep 1
exec "$@"

