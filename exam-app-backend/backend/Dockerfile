# Use Node.js 20 Alpine image
FROM node:20-alpine

# Set the working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy the rest of the application
COPY . .

# Expose the application port
EXPOSE 5000

# Start the application
CMD ["npm", "start"]
