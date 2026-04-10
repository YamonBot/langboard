FROM node:22
WORKDIR /app

COPY ./socket /app
COPY ./shared/ts /shared/ts

RUN cd /shared/ts && yarn install && yarn run build && yarn link

RUN yarn config set registry "http://registry.npmjs.org"

RUN cd /app && yarn install
RUN yarn build
RUN yarn global add pm2

CMD ["pm2-runtime", "ecosystem.config.cjs"]
