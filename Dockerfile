# SamiMeds – Cloud Run image
FROM node:22-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY src ./src
COPY public ./public

# Run as the unprivileged "node" user that ships with the image.
USER node
EXPOSE 8080
CMD ["node", "src/server.js"]
