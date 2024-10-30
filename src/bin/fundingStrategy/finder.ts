import { getMarketPda, Market, MarketWrapper, ParclV3Sdk, ProgramAccount } from "@parcl-oss/v3-sdk";
import { PublicKey } from "@solana/web3.js";
import Decimal from "decimal.js";


export async function findHighestFundingRate(
  sdk: ParclV3Sdk,
  exchangeAddress: PublicKey,
) {
  const exchange = await sdk.accountFetcher.getExchange(exchangeAddress);
  if (exchange === undefined) {
    throw new Error("Invalid exchange address");
  }
  const allMarketAddresses: PublicKey[] = [];
  const marketIds = exchange.marketIds.filter(marketId => marketId <= 22);
  for (const marketId of marketIds) {
    if (marketId === 0) {
      continue;
    }
    const [market] = getMarketPda(exchangeAddress, marketId);
    allMarketAddresses.push(market);
  }
  const allMarkets = await sdk.accountFetcher.getMarkets(allMarketAddresses);
  const highestAbsoluteFundingRate: { market: ProgramAccount<Market> | undefined; value: Decimal } =
    { market: undefined, value: new Decimal(0) };
  for (const market of allMarkets) {
    if (market === undefined) {
      continue;
    }
    const marketWrapper = new MarketWrapper(market.account);
    if (
        (new Decimal(market.account.accounting.skew.toString())
            .mul(marketWrapper.lastFundingRate().val)
            .lt(0))) {
        continue;
    }
    const fundingRate = marketWrapper.lastFundingRate().val;
    if (Decimal.abs(fundingRate).gt(Decimal.abs(highestAbsoluteFundingRate.value))) {
      highestAbsoluteFundingRate.market = market;
      highestAbsoluteFundingRate.value = fundingRate;
    }
  }
  return highestAbsoluteFundingRate;
}
