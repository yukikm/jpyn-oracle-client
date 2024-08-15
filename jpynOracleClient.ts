import { abi } from "./artifacts/contracts/JpynOracle.sol/JpynOracle.json";
import * as dotenv from "dotenv";
import { ethers } from "ethers";
import sqlite3 from "sqlite3";
import axios from "axios";
import log4js from "log4js";

dotenv.config();

const logger = log4js.getLogger();
logger.level = "all";
log4js.configure({
  appenders: {
    app: { type: "file", filename: "application.log" },
  },
  categories: {
    default: { appenders: ["app"], level: "debug" },
  },
});

const db = new sqlite3.Database("./local.db", (err) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log("Connected to the local SQLite database.");
  }
});

db.serialize(() => {
  db.run(
    "CREATE TABLE IF NOT EXISTS requestId (id INTEGER PRIMARY KEY AUTOINCREMENT, requestId INTEGER)",
    (err) => {
      if (err) {
        console.error(err.message);
      } else {
        db.run("INSERT INTO requestId (requestId) VALUES (0)", (err) => {
          if (err) {
            console.error(err.message);
          } else {
            console.log("Initial requestId inserted.");
          }
        });
      }
    }
  );
});

const privateKey: any = process.env.PRIVATE_KEY;
const contractAddress: any = process.env.ORACLE_CONTRACT_ADDRESS;

const provider = new ethers.JsonRpcProvider(process.env.PROVIDER_URL);
const wallet = new ethers.Wallet(privateKey, provider);

const contract = new ethers.Contract(contractAddress, abi, wallet);

async function getRequest() {
  const filter = contract.filters.NewRequest;
  const events = await contract.queryFilter(filter);
  return events;
}

async function updateRequest(
  requestId: number,
  accountStatus: number,
  accountBalance: number
) {
  await contract.updateRequest(requestId, accountStatus, accountBalance);
}

function generateRandomString(length = 16) {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

async function requestMufgAPI(bankAccount: string) {
  const today = new Date();
  const todayMont =
    today.getMonth() + 1 < 10
      ? `0${today.getMonth() + 1}`
      : today.getMonth() + 1;
  const todayDate =
    today.getDate() < 10 ? `0${today.getDate()}` : today.getDate();
  const formattedDate = `${today.getFullYear()}${todayMont}${todayDate}`;
  const request = await axios.get(`${process.env.MUFG_API}/${bankAccount}`, {
    headers: {
      "X-IBM-Client-Id": `${process.env.MUFG_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-BTMU-Seq-No": `${formattedDate}-${generateRandomString()}`,
    },
  });
  return request;
}

async function getBankAccount(hashedAccount: string) {
  const res = await fetch(
    `${process.env.API_URL}/api/bank?hashedAccount=${hashedAccount}`
  );
  const data = await res.json();
  return data.res[0];
}

async function updateRequestId(requestId: number) {
  db.run(`UPDATE requestId SET requestId=${requestId} WHERE id=1`);
}

async function _getCurrentRequestId(): Promise<number> {
  return await new Promise((resolve, reject) => {
    db.all(`SELECT * FROM requestId WHERE id=1`, [], (err, rows) => {
      if (err) {
        reject(err);
      }
      let id = 0;
      rows.forEach((row: any) => {
        id = row.requestId;
      });
      resolve(id);
    });
  });
}

async function getCurrentRequestId() {
  const id = await _getCurrentRequestId();
  return id;
}

function checkNewRequest(currentLocalRequestId: number, requestId: number) {
  if (currentLocalRequestId <= requestId) {
    return true;
  } else {
    return false;
  }
}

async function main() {
  while (true) {
    await waitOneMinute();
    try {
      const events: any = await getRequest();
      const currentRequestId = await getCurrentRequestId();
      logger.info("currentRequestId: ", currentRequestId);

      if (!checkNewRequest(currentRequestId, events.length - 1)) {
        logger.info("No new request");
        continue;
      }

      const requestId = events[currentRequestId].args[0];
      logger.info("requestId: ", requestId);
      const hashedAccount = events[currentRequestId].args[1];
      logger.info("hashedAccount: ", hashedAccount);
      const bankAccount = await getBankAccount(hashedAccount);
      if (bankAccount) {
        try {
          const request = await requestMufgAPI(
            `${bankAccount.branchNo}${bankAccount.accountTypeCode}${bankAccount.accountNo}`
          );
          await updateRequest(
            Number(requestId),
            1,
            request.data.clearedBalance
          );
        } catch (error) {
          await updateRequest(Number(requestId), 2, 0);
          updateRequestId(Number(currentRequestId) + 1);
          logger.error("Error: ", error);
        }
      } else {
        await updateRequest(Number(requestId), 2, 0);
        updateRequestId(Number(currentRequestId) + 1);
        logger.info("Bank account not found");
      }
      updateRequestId(Number(currentRequestId) + 1);
    } catch (error) {
      logger.error("Error: ", error);
      continue;
    }
  }
}

async function waitOneMinute() {
  return await new Promise((resolve) => setTimeout(resolve, 30000));
}

main();
