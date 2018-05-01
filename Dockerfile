FROM node:8
ENV TERM=xterm

USER node
WORKDIR /home/node

COPY package.json /home/node

COPY node_modules /home/node/node_modules

COPY config.js.template /home/node/config.js
COPY index.js /home/node/
COPY lib /home/node/lib

EXPOSE 5000
CMD [ "npm", "start" ]
