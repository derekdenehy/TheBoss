FROM node:20-alpine

WORKDIR /app

# For Docker Compose: proxy API calls to backend service (override with build-arg if needed)
ARG API_PROXY=http://backend:8000

COPY package*.json ./
RUN npm ci

COPY . .
# Point CRA dev server proxy at backend container when running in compose
RUN sed -i "s|http://localhost:8000|${API_PROXY}|g" package.json

EXPOSE 3000

CMD ["npm", "start"]
