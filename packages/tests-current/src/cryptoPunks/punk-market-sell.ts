import {Contract} from "web3-eth-contract"
import {RaribleSdk} from "@rarible/protocol-ethereum-sdk"
import {CryptoPunkOrder} from "@rarible/ethereum-api-client/build/models/Order"
import {expectEqual, expectLength} from "../common/expect-equal"
import {retry} from "../common/retry"
import {printLog, runLogging} from "./util"
import {checkSellOrder, getInactiveOrdersForPunkByType, getOrdersForPunkByType} from "./common-sell"
import {
	ASSET_TYPE_ETH,
	ORDER_TYPE_CRYPTO_PUNK,
	punkIndex,
} from "./crypto-punks"

/**
 * Creates sell order from [maker] in the punk market.
 */
export async function createPunkMarketSellOrder(
	price: number,
	maker: string,
	contract: Contract,
	sdk: RaribleSdk
): Promise<CryptoPunkOrder> {
	await contract.methods.offerPunkForSale(punkIndex, price).send({from: maker})
	const rawSell = await contract.methods.punksOfferedForSale(punkIndex).call()
	expectEqual(rawSell.isForSale, true, "rawSell.isForSale")
	expectEqual(rawSell.seller.toLowerCase(), maker, "rawSell.seller")
	expectEqual(rawSell.minValue, price.toString(), "rawSell.minValue")
	expectEqual(rawSell.punkIndex, punkIndex.toString(), "rawSell.punkIndex")
	let order = await retry(3, async () => {
		const orders = await getPunkMarketOrders(sdk, maker)
		expectLength(orders, 1, "punk market orders count")
		return orders[0]
	})
	printLog(`Created punk market order: ${JSON.stringify(order)}`)
	checkSellOrder(order, ASSET_TYPE_ETH, price, maker)
	return order
}

/**
 * Request CRYPTO_PUNK sell orders from API.
 */
export async function getPunkMarketOrders(sdk: RaribleSdk, maker: string | undefined): Promise<CryptoPunkOrder[]> {
	return await runLogging(
		"request CRYPTO_PUNK sell orders",
		getOrdersForPunkByType<CryptoPunkOrder>(sdk, ORDER_TYPE_CRYPTO_PUNK, maker)
	)
}

/**
 * Ensure the API does not return any CRYPTO_PUNK sell orders.
 */
export async function checkApiNoMarketOrders(sdk: RaribleSdk) {
	await runLogging(
		"ensure no punk market sell orders in API",
		retry(3, async () => {
			const orders = await getPunkMarketOrders(sdk, undefined)
			expectLength(orders, 0, "punk sell orders count")
		})
	)
}

/**
 * Cancel native sell orders, if any. Ensure there are no native sell orders in the API response.
 */
export async function cancelOrderInPunkMarket(sdk: RaribleSdk, maker: string, contract: Contract) {
	const forSale = await contract.methods.punksOfferedForSale(punkIndex).call()
	if (!forSale.isForSale) {
		printLog(`No sell orders found in punk market with maker = ${maker}`)
		return
	}
	if (forSale.seller.toLowerCase() !== maker) {
		printLog(`Sell order is from another maker ${maker}`)
		return
	}
	expectEqual(forSale.seller.toLowerCase(), maker, "seller")
	printLog("Found sell order in punk market, cancelling it")
	await contract.methods.punkNoLongerForSale(punkIndex).send({from: maker})
	await checkApiNoMarketOrders(sdk)
}


/**
 * Request INACTIVE CRYPTO_PUNK sell orders from API.
 */
export async function getInactivePunkMarketOrders(sdk: RaribleSdk, maker: string): Promise<CryptoPunkOrder[]> {
	return await runLogging(
		"request INACTIVE RaribleV2 sell orders",
		getInactiveOrdersForPunkByType(sdk, maker, ORDER_TYPE_CRYPTO_PUNK)
	)
}
