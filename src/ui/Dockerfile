FROM node:22
WORKDIR /app

COPY ./ui /app
COPY ./shared/ts /shared/ts

RUN cd /shared/ts && yarn install && yarn run build && yarn link

RUN yarn config set registry "http://registry.npmjs.org"

RUN cd /app && yarn install --network-timeout 100000
