# Development Dockerfile for React + Vite
FROM node:20-alpine
WORKDIR /app

# Copy package.json and install dependencies (Leverage Docker cache)
COPY package.json ./
RUN npm install

# Copy source code
COPY . .

# Start development server
CMD ["npm", "run", "dev"]
