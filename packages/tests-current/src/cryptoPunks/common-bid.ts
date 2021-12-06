import {EthAssetType, Platform, RaribleV2Order} from "@rarible/ethereum-api-client"
import {CryptoPunkOrder, Order} from "@rarible/ethereum-api-client/build/models/Order"
import {Erc20AssetType} from "@rarible/ethereum-api-client/build/models"
import {expectEqual, expectEqualStrict, expectLength} from "../common/expect-equal"
import {retry} from "../common/retry"
import {cryptoPunksAddress} from "../contracts/crypto-punks"
import {toBn} from "../common/to-bn"
import {ASSET_TYPE_CRYPTO_PUNK, punkIndex} from "./crypto-punks"
import {apiSdk, RETRY_ATTEMPTS, runLogging} from "./util"
import {getApiRariblePunkBids} from "./rarible-bid"

export function checkBidFields(
	bid: RaribleV2Order | CryptoPunkOrder,
	maker: string,
	makeAssetType: EthAssetType | Erc20AssetType,
	price: number,
	taker: string | undefined = undefined
) {
	expectEqualStrict(bid.make.assetType, makeAssetType, "type of bid.make.asset")
	expectEqualStrict(toBn(bid.make.value), toBn(price), "bid make.value")
	expectEqual(bid.maker, maker, "bid.maker")

	expectEqual(bid.taker, taker, "bid.taker")
	expectEqualStrict(bid.take.assetType, ASSET_TYPE_CRYPTO_PUNK, "type of bid.take.asset")
	expectEqual(bid.take.valueDecimal, 1, "bid.take.valueDecimal")
}

/**
 * Ensure the API does not return any RARIBLE_V2 bids.
 */
export async function checkApiNoRaribleBids() {
	await runLogging(
		"ensure no rarible bids in API",
		retry(RETRY_ATTEMPTS, async () => {
			const bids = await getApiRariblePunkBids(undefined)
			expectLength(bids, 0, "unexpected Rarible bids")
		})
	)
}

/**
 * @see getApiRariblePunkBids
 * @see getPunkMarketBids
 */
export async function getBidsForPunkByType<T extends Order>(
	maker: string | undefined,
	type: String
): Promise<T[]> {
	const bids = (await apiSdk.apis.order.getOrderBidsByItem({
		contract: cryptoPunksAddress,
		tokenId: punkIndex.toString(),
		platform: Platform.ALL,
		maker: maker,
	})).orders
	return bids
		.filter(a => a["type"] === type)
		.map(o => o as T)
}
