# Базовый образ Playwright (с браузерами)
FROM mcr.microsoft.com/playwright:v1.54.2-jammy

# ---- твоя часть: зависимости проекта ----
WORKDIR /app
COPY package*.json ./
RUN npm ci && npx playwright install --with-deps

# Чтобы код лежал в /app/src, а зависимости виделись из /app/node_modules
ENV NODE_PATH=/app/node_modules

# Выбираем тайм-зону (например, Алматы)
ENV TZ=Asia/Almaty

# Неинтерактивная установка + VNC + WM
RUN --mount=type=cache,target=/var/cache/apt \
    --mount=type=cache,target=/var/lib/apt \
    apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends tzdata x11vnc fluxbox \
 && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone \
 && rm -rf /var/lib/apt/lists/*

# В образе Playwright Xvfb уже есть; просто укажем дисплей
ENV DISPLAY=:99

# стартуем Xvfb и VNC, затем выполняем переданную команду
COPY scripts/start-vnc.sh /usr/local/bin/start-vnc.sh
RUN chmod +x /usr/local/bin/start-vnc.sh

# возвращаем безопасного юзера Playwright
USER root
RUN mkdir -p /tmp/.X11-unix && chmod 1777 /tmp/.X11-unix
USER pwuser
