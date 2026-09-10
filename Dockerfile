FROM node:24-alpine
WORKDIR /app
COPY server ./server
COPY index.html config.js app.js backend-auth.js sync.js ui.js content.js merge.js outline.js journal.js sw.js manifest.webmanifest icon-192.png icon-512.png apple-touch-icon.png ./
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080
USER node
EXPOSE 8080
CMD ["node","server/auth-server.mjs"]
