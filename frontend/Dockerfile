FROM node:18-alpine

WORKDIR /app

# Копируем package.json и lock-файл
COPY package.json package-lock.json* ./

# Устанавливаем зависимости
RUN npm install

# Копируем остальной код
COPY . .

# Порт dev-сервера
EXPOSE 3000

# Запуск dev-сервера
CMD ["npm", "start"]