FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY apps/server/package.json ./apps/server/package.json
RUN npm install
COPY tsconfig.json ./
COPY apps ./apps
COPY scripts ./scripts
COPY database ./database
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json ./
COPY apps/server/package.json ./apps/server/package.json
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/database ./database
EXPOSE 4000
CMD ["npm", "run", "start:server"]
