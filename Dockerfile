FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN npm install
COPY tsconfig.json ./
COPY apps ./apps
COPY scripts ./scripts
COPY database ./database
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/database ./database
COPY --from=build /app/apps/web/dist ./apps/web/dist
EXPOSE 4000
CMD ["npm", "run", "start:server"]
