import {EthAssetType, Platform, RaribleV2Order} from "@rarible/ethereum-api-client"
import {CryptoPunkOrder, Order} from "@rarible/ethereum-api-client/build/models/Order"
import {Erc20AssetType} from "@rarible/ethereum-api-client/build/models"
import {AssetTypeRequest} from "@rarible/protocol-ethereum-sdk/build/order/check-asset-type"
import {RaribleSdk} from "@rarible/protocol-ethereum-sdk"
import {SellRequest} from "@rarible/protocol-ethereum-sdk/build/order/sell"
import {toAddress} from "@rarible/types"
import {cryptoPunksAddress} from "../contracts/crypto-punks"
import {apiSdk, printLog, RETRY_ATTEMPTS, runLogging} from "./util"
import {toBn} from "./to-bn"
import {retry} from "./retry"
import {hasContractAndTokenId} from "./api-bid"

export function checkFieldsOfSellOrder(
	order: RaribleV2Order | CryptoPunkOrder,
	takeAssetType: EthAssetType | Erc20AssetType,
	price: number,
	maker: string,
	taker: string | undefined = undefined
) {
	expect(order.make.value).toBe("1")
	expect(order.makeStock).toBe("1")
	expect(order.maker).toBe(maker)

	expect(order.taker).toBe(taker)
	expect(toBn(order.take.value)).toStrictEqual(toBn(price))
	expect(order.take.assetType).toStrictEqual(takeAssetType)
}


/**
 * Creates RARIBLE_V2 sell order for punk.
 */
export async function createRaribleSellOrder(
	maker: string,
	makeAssetType: AssetTypeRequest,
	takeAssetType: EthAssetType | Erc20AssetType,
	price: number,
	sdk: RaribleSdk
): Promise<RaribleV2Order> {
	let isErc20 = "contract" in takeAssetType
	let newVar: SellRequest = {
		makeAssetType: makeAssetType,
		amount: 1,
		maker: toAddress(maker),
		originFees: [],
		payouts: [],
		price: price,
		takeAssetType: takeAssetType,
	}
	let sellOrder = await runLogging(
		`create ${isErc20 ? "ERC20" : "ETH"} sell order with price ${price}`,
		sdk.order.sell(newVar).then((order) => order as RaribleV2Order)
	)
	printLog(`Created sell order: ${JSON.stringify(sellOrder)}`)
	checkFieldsOfSellOrder(sellOrder, takeAssetType, price, maker)
	await checkApiSellOrderExists(sellOrder)
	return sellOrder
}

/**
 * Request RARIBLE_v2 sell orders from API.
 */
export async function getApiRaribleSellOrders(
	contract: string,
	tokenId: string,
	maker: string | undefined
): Promise<RaribleV2Order[]> {
	return await getApiSellOrders<RaribleV2Order>(contract, tokenId, maker, "RARIBLE_V2")
}

/**
 * Request CRYPTO_PUNK sell orders from API.
 */
export async function getApiPunkMarketSellOrders(
	punkIndex: number,
	maker: string | undefined
): Promise<CryptoPunkOrder[]> {
	return getApiSellOrders(
		cryptoPunksAddress,
		punkIndex.toString(),
		maker,
		"CRYPTO_PUNK"
	)
}

async function getApiSellOrders<T extends Order>(
	contract: string,
	tokenId: string,
	maker: string | undefined,
	type: "RARIBLE_V2" | "CRYPTO_PUNK" | undefined
): Promise<T[]> {
	const orders = await runLogging(
		`request ${type} sell orders of ${contract}:${tokenId} from API for maker = ${maker}`,
		apiSdk.apis.order.getSellOrdersByItem({
			contract: contract,
			tokenId: tokenId,
			platform: Platform.ALL,
			maker: maker,
		})
	)
	return orders
		.orders
		.filter(a => type === undefined || a["type"] === type)
		.map(o => o as T)
}

/**
 * Ensure the API returns Rarible punk sell order.
 */
export async function checkApiSellOrderExists(sellOrder: RaribleV2Order | CryptoPunkOrder) {
	let makeAssetType = sellOrder.make.assetType
	if (hasContractAndTokenId(makeAssetType)) {
		let contract = makeAssetType.contract
		let tokenId = makeAssetType.tokenId.toString()
		await runLogging(
			`Check sell order exists in API ${JSON.stringify(sellOrder)}`,
			retry(RETRY_ATTEMPTS, async () => {
				const sellOrders = await getApiSellOrders(contract, tokenId, sellOrder.maker, undefined)
				expect(sellOrders).toContainEqual(sellOrder)
			})
		)
	}
}

/**
 * Ensure the API does not return any sell orders for {@param contract}:${@param tokenId}
 * and {@param maker} of {@param type}.
 */
export async function checkApiNoSellOrders(
	contract: string,
	tokenId: string,
	maker: string | undefined,
	type: "RARIBLE_V2" | "CRYPTO_PUNK" | undefined = undefined
) {
	await runLogging(
		`ensure no sell orders for ${contract}:${tokenId} in API with maker ${maker}`,
		retry(RETRY_ATTEMPTS, async () => {
			const sellOrders = await getApiSellOrders<Order>(contract, tokenId, maker, type)
			expect(sellOrders).toHaveLength(0)
		})
	)
}
