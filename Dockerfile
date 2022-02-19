# NOTE: this is not used b/c we deploy from source currently
FROM node:16
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --only=production
# Bundle app source
COPY . .
EXPOSE 8080
CMD [ "node", "src/index.mjs" ]
