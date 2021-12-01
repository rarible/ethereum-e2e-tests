import {Asset, EthAssetType, OrderStatus, Platform, RaribleV2Order} from "@rarible/ethereum-api-client"
import {CryptoPunkOrder, Order} from "@rarible/ethereum-api-client/build/models/Order"
import {CryptoPunksAssetType, Erc20AssetType} from "@rarible/ethereum-api-client/build/models"
import {RaribleSdk} from "@rarible/protocol-ethereum-sdk"
import {expectEqual} from "../common/expect-equal"
import {cryptoPunksAddress} from "../contracts/crypto-punks"
import {ASSET_TYPE_CRYPTO_PUNK, punkIndex} from "./crypto-punks"

export function checkSellOrder(
	order: RaribleV2Order | CryptoPunkOrder,
	takeAssetType: EthAssetType | Erc20AssetType,
	price: number,
	maker: string,
	taker: string | undefined = undefined
) {
	expectEqual(order.make.assetType, ASSET_TYPE_CRYPTO_PUNK, "type of order.make.asset")
	expectEqual(order.make.value, "1", "order.make.value")
	expectEqual(order.makeStock, "1", "order.makeStock")
	expectEqual(order.maker, maker, "order.maker")

	expectEqual(order.taker, taker, "order.taker")
	expectEqual(order.take.assetType, takeAssetType, "type of order.take.asset")
}

export async function getOrdersForPunkByType<T extends Order>(
	sdk: RaribleSdk,
	type: String,
	maker: string | undefined
): Promise<T[]> {
	const orders = (await sdk.apis.order.getSellOrdersByItem({
		contract: cryptoPunksAddress,
		tokenId: punkIndex.toString(),
		platform: Platform.ALL,
		maker: maker,
	})).orders
	return orders
		.filter(a => a["type"] === type)
		.map(o => o as T)
}

/**
 * @see getInactiveRaribleOrders
 * @see getInactivePunkMarketOrders
 */
export async function getInactiveOrdersForPunkByType<T extends Order>(
	sdk: RaribleSdk,
	maker: string,
	type: String
): Promise<T[]> {
	const orders = (await sdk.apis.order.getSellOrdersByMakerAndByStatus({
		maker: maker,
		platform: Platform.ALL,
		status: [OrderStatus.INACTIVE],
	})).orders
	return orders
		.filter(a => a["type"] === type && ((a["make"] as Asset)["assetType"] as CryptoPunksAssetType)["tokenId"] === punkIndex)
		.map(o => o as T)
}
