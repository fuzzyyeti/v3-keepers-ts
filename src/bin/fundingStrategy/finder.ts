import { getMarketPda, Market, MarketWrapper, ParclV3Sdk, ProgramAccount } from "@parcl-oss/v3-sdk";
import { PublicKey } from "@solana/web3.js";
import Decimal from "decimal.js";


export async function findLowestSkew(
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
  const lowestSkew: { market: ProgramAccount<Market> | undefined; skew: Decimal; fundingRate: Decimal} =
    { market: undefined, skew: new Decimal(0), fundingRate: new Decimal(0) };
  for (const market of allMarkets) {
    if (market === undefined) {
      continue;
    }
    const marketWrapper = new MarketWrapper(market.account);
    // Make sure funding benefit is on the minority side
    if (
        (new Decimal(market.account.accounting.skew.toString())
            .mul(marketWrapper.lastFundingRate().val)
            .lt(0))) {
        continue;
    }
    const skew = new Decimal(market.account.accounting.skew.toString()).div(new Decimal(market.account.settings.skewScale.toString()));
    if(Decimal.abs(skew).lt(lowestSkew.skew) || lowestSkew.skew.eq(new Decimal(0))) {
        lowestSkew.market = market;
        lowestSkew.skew = Decimal.abs(skew);
        lowestSkew.fundingRate = marketWrapper.lastFundingRate().val;
    }
  }
  return lowestSkew;
}
