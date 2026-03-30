FROM node:20-alpine

WORKDIR /app

# Install dependencies first (cached layer)
COPY package*.json ./


# Copy the rest of the app
COPY . .

RUN rm -rf node_modules package-lock.json&& npm install

RUN npx prisma generate

EXPOSE 3000

# Entrypoint script handles migrations + seed + start
CMD ["sh", "startup.sh"]