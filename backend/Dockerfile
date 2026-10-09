FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
ENV PORT=4000

# No corras el proceso como root dentro del contenedor.
# La imagen node:20-alpine ya trae el usuario "node" creado.
USER node

EXPOSE 4000
CMD ["npm", "start"] 