import {EthAssetType, Platform, RaribleV2Order} from "@rarible/ethereum-api-client"
import {CryptoPunkOrder, Order} from "@rarible/ethereum-api-client/build/models/Order"
import {Erc20AssetType} from "@rarible/ethereum-api-client/build/models"
import {expectEqual, expectEqualStrict} from "../common/expect-equal"
import {cryptoPunksAddress} from "../contracts/crypto-punks"
import {toBn} from "../common/to-bn"
import {ASSET_TYPE_CRYPTO_PUNK, punkIndex} from "./crypto-punks"
import {apiSdk} from "./common-eth"

export function checkSellOrder(
	order: RaribleV2Order | CryptoPunkOrder,
	takeAssetType: EthAssetType | Erc20AssetType,
	price: number,
	maker: string,
	taker: string | undefined = undefined
) {
	expectEqualStrict(order.make.assetType, ASSET_TYPE_CRYPTO_PUNK, "type of order.make.asset")
	expectEqual(order.make.value, "1", "order.make.value")
	expectEqual(order.makeStock, "1", "order.makeStock")
	expectEqual(order.maker, maker, "order.maker")

	expectEqual(order.taker, taker, "order.taker")
	expectEqualStrict(toBn(order.take.value), toBn(price), "order take.value")
	expectEqualStrict(order.take.assetType, takeAssetType, "type of order.take.asset")
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
