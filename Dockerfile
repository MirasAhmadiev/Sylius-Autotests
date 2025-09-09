# База с браузерами и всеми deps
FROM mcr.microsoft.com/playwright:v1.54.2-jammy

# Рабочая папка
WORKDIR /app

# Ставим зависимости по lock-файлу (кэшируется как слой)
COPY package*.json ./
RUN npm ci

# Кладём исходники
COPY . .

# Опционально: часовой пояс (без apt, просто env)
ENV TZ=Asia/Almaty

# Пользователь по умолчанию уже pwuser в base image
# Никаких DISPLAY, VNC, X11 не нужно

# По умолчанию просто даём команду; в compose можно переопределить
CMD ["npx", "playwright", "test"]
