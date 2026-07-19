FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (npm install tolerates a stale or absent lockfile;
# switch back to `npm ci --omit=dev` once package-lock.json is refreshed)
RUN npm install --omit=dev

# Copy source code
COPY src/ ./src/
COPY public/ ./public/

# Create logs directory and hand the app over to the non-root node user
RUN mkdir -p logs && chown -R node:node /app
USER node

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["npm", "start"]
