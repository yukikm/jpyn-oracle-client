FROM node:21

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

ENV PRIVATE_KEY=xxxxxxxxxxxxxxx
ENV ORACLE_CONTRACT_ADDRESS=xxxxxxxxxxxxxxx
ENV PROVIDER_URL="https://rpc-1.testnet.japanopenchain.org:8545"
ENV MUFG_API="https://developer.api.bk.mufg.jp/btmu/corporation/trial/v1/accounts"
ENV MUFG_API_KEY=xxxxxxxxxxxxxxx
ENV API_URL=xxxxxxxxxxxxxxx

CMD ["npx", "ts-node", "jpynOracleClient.ts"]