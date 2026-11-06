FROM node:20-alpine as deps
WORKDIR /app
COPY package.json /app
RUN npm install --omit=dev

FROM node:20-alpine
WORKDIR /app
COPY --from=deps /app/node_modules /app/node_modules
COPY src /app/src
USER node
EXPOSE 3000
CMD ["node", "src/server.js"] 