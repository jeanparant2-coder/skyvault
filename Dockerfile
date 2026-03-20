FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p /data/storage

ENV PORT=3000
ENV STORAGE_ROOT=/data/storage

EXPOSE 3000

CMD ["npm", "start"]
