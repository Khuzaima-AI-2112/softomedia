FROM node:18-slim
WORKDIR /app
EXPOSE 8080
COPY package.json package-lock.json* ./
RUN npm install --production
COPY . .
CMD ["node", "index.js"]
