import * as dotenv from "dotenv";
import { getExchangePda, ParclV3Sdk } from "@parcl-oss/v3-sdk";
import { Commitment, Connection, Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { closePosition } from "./fundingStrategy/closePosition";
import { findLowestSkew } from "./fundingStrategy/finder";
import { createMarginAccount } from "./fundingStrategy/createMarginAccount";
import { openPosition } from './fundingStrategy/openPosition';

dotenv.config();
const LEVERAGE = 20;

(async function main() {
  console.log("Starting funding stretegy");
  if (process.env.RPC_URL === undefined) {
    throw new Error("Missing rpc url");
  }
  if (process.env.FUNDING_STRATEGY_MARGIN_ACCOUNT === undefined) {
    throw new Error("Missing liquidator margin account");
  }
  if (process.env.PRIVATE_KEY === undefined) {
    throw new Error("Missing liquidator signer");
  }

  const close = process.argv.includes("close");
  const create = process.argv.includes("create");
  const open = process.argv.includes("open");
  const check = process.argv.includes("check");

  const [exchangeAddress] = getExchangePda(0);
  const fundingStrategySigner = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY));
  const commitment = process.env.COMMITMENT as Commitment | undefined;
  const sdk = new ParclV3Sdk({ rpcUrl: process.env.RPC_URL, commitment });
  const connection = new Connection(process.env.RPC_URL, commitment);

  if (create) {
    await createMarginAccount(connection, sdk, exchangeAddress, fundingStrategySigner);
  }
  if (open) {
    const lowestSkew = await findLowestSkew(sdk, exchangeAddress);
    console.log(lowestSkew);
    if (lowestSkew.market === undefined) {
      console.log("No market found");
      return;
    }
    console.log("Opening a new position");
    const isLong = lowestSkew.fundingRate.lt(0);
    await openPosition(
      connection,
      sdk,
      exchangeAddress,
      fundingStrategySigner,
      lowestSkew.market.account.id,
      LEVERAGE,
      isLong
    );
  }
  if (check) {
    await closePosition(connection, sdk, exchangeAddress, fundingStrategySigner, 0, false);
  }
  if (close) {
    await closePosition(connection, sdk, exchangeAddress, fundingStrategySigner, 0, true);
  }
})();
