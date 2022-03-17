FROM node:16-alpine

WORKDIR /usr/src/app/


COPY package.json package-lock.json ./
RUN npm install

COPY ./src ./src

ENV NODE_ENV=docker
EXPOSE 8080
CMD npm run start