import {Asset, EthAssetType, OrderStatus, Platform, RaribleV2Order} from "@rarible/ethereum-api-client"
import {CryptoPunkOrder, Order} from "@rarible/ethereum-api-client/build/models/Order"
import {CryptoPunksAssetType, Erc20AssetType} from "@rarible/ethereum-api-client/build/models"
import {RaribleSdk} from "@rarible/protocol-ethereum-sdk"
import {expectEqual, expectLength} from "../common/expect-equal"
import {retry} from "../common/retry"
import {cryptoPunksAddress} from "../contracts/crypto-punks"
import {ASSET_TYPE_CRYPTO_PUNK, punkIndex} from "./crypto-punks"
import {runLogging} from "./util"
import {getRariblePunkBids} from "./rarible-bid"

export function checkBidFields(
	bid: RaribleV2Order | CryptoPunkOrder,
	makeAssetType: EthAssetType | Erc20AssetType,
	price: number,
	maker: string,
	taker: string | undefined = undefined
) {
	expectEqual(bid.make.assetType, makeAssetType, "type of bid.make.asset")
	expectEqual(bid.maker, maker, "bid.maker")

	expectEqual(bid.taker, taker, "bid.taker")
	expectEqual(bid.take.assetType, ASSET_TYPE_CRYPTO_PUNK, "type of bid.take.asset")
	expectEqual(bid.take.valueDecimal, 1, "bid.take.valueDecimal")
}

/**
 * Ensure the API does not return any RARIBLE_V2 bids.
 */
export async function checkApiNoRaribleBids(sdk: RaribleSdk) {
	await runLogging(
		"ensure no rarible bids in API",
		retry(3, async () => {
			const bids = await getRariblePunkBids(undefined, sdk)
			expectLength(bids, 0, "rarible bids count")
		})
	)
}

/**
 * @see getInactivePunkMarketBids
 */
export async function getInactiveBidsForPunkByType<T extends Order>(
	sdk: RaribleSdk,
	maker: string,
	type: String
): Promise<T[]> {
	const orders = (await sdk.apis.order.getOrderBidsByMakerAndByStatus({
		maker: maker,
		platform: Platform.ALL,
		status: [OrderStatus.INACTIVE],
	})).orders
	return orders
		.filter(a => a["type"] === type && ((a["take"] as Asset)["assetType"] as CryptoPunksAssetType)["tokenId"] === punkIndex)
		.map(o => o as T)
}

/**
 * @see getRariblePunkBids
 * @see getPunkMarketBids
 */
export async function getBidsForPunkByType<T extends Order>(
	sdk: RaribleSdk,
	type: String,
	maker: string | undefined
): Promise<T[]> {
	const bids = (await sdk.apis.order.getOrderBidsByItem({
		contract: cryptoPunksAddress,
		tokenId: punkIndex.toString(),
		platform: Platform.ALL,
		maker: maker,
	})).orders
	return bids
		.filter(a => a["type"] === type)
		.map(o => o as T)
}
