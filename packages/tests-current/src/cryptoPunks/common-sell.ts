import {EthAssetType, Platform, RaribleV2Order} from "@rarible/ethereum-api-client"
import {CryptoPunkOrder, Order} from "@rarible/ethereum-api-client/build/models/Order"
import {Erc20AssetType} from "@rarible/ethereum-api-client/build/models"
import {cryptoPunksAddress} from "../contracts/crypto-punks"
import {toBn} from "../common/to-bn"
import {ASSET_TYPE_CRYPTO_PUNK, punkIndex} from "./crypto-punks"
import {apiSdk} from "./util"

export function checkSellOrder(
	order: RaribleV2Order | CryptoPunkOrder,
	takeAssetType: EthAssetType | Erc20AssetType,
	price: number,
	maker: string,
	taker: string | undefined = undefined
) {
	expect(order.make.assetType).toStrictEqual(ASSET_TYPE_CRYPTO_PUNK)
	expect(order.make.value).toBe("1")
	expect(order.makeStock).toBe("1")
	expect(order.maker).toBe(maker)

	expect(order.taker).toBe(taker)
	expect(toBn(order.take.value)).toStrictEqual(toBn(price))
	expect(order.take.assetType).toStrictEqual(takeAssetType)
}

export async function getApiSellOrdersForPunkByType<T extends Order>(
	type: String,
	maker: string | undefined
): Promise<T[]> {
	const orders = (await apiSdk.apis.order.getSellOrdersByItem({
		contract: cryptoPunksAddress,
		tokenId: punkIndex.toString(),
		platform: Platform.ALL,
		maker: maker,
	})).orders
	return orders
		.filter(a => a["type"] === type)
		.map(o => o as T)
}
