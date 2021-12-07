import {EthAssetType, Platform, RaribleV2Order} from "@rarible/ethereum-api-client"
import {CryptoPunkOrder, Order} from "@rarible/ethereum-api-client/build/models/Order"
import {Erc20AssetType} from "@rarible/ethereum-api-client/build/models"
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
	expect(bid.make.assetType).toStrictEqual(makeAssetType)
	expect(toBn(bid.make.value)).toStrictEqual(toBn(price))
	expect(bid.maker).toBe(maker)

	expect(bid.taker).toBe(taker)
	expect(bid.take.assetType).toStrictEqual(ASSET_TYPE_CRYPTO_PUNK)
	expect(bid.take.valueDecimal).toBe(1)
}

/**
 * Ensure the API does not return any RARIBLE_V2 bids.
 */
export async function checkApiNoRaribleBids() {
	await runLogging(
		"ensure no rarible bids in API",
		retry(RETRY_ATTEMPTS, async () => {
			const bids = await getApiRariblePunkBids(undefined)
			expect(bids).toHaveLength(0)
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
