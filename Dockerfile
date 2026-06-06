FROM node:22-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client ./
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY server/package*.json ./server/
RUN npm install --prefix server --omit=dev
COPY server ./server
COPY --from=client-build /app/client/dist ./client/dist
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "server/src/index.js"]
