import {Contract} from "web3-eth-contract"
import {CryptoPunkOrder} from "@rarible/ethereum-api-client/build/models/Order"
import {expectEqual, expectLength} from "../common/expect-equal"
import {retry} from "../common/retry"
import {printLog, RETRY_ATTEMPTS, runLogging} from "./util"
import {checkSellOrder, getApiSellOrdersForPunkByType} from "./common-sell"
import {
	ASSET_TYPE_ETH,
	ORDER_TYPE_CRYPTO_PUNK,
	punkIndex,
} from "./crypto-punks"

/**
 * Creates sell order from [maker] in the punk market.
 */
export async function createPunkMarketSellOrder(
	maker: string,
	price: number,
	contract: Contract
): Promise<CryptoPunkOrder> {
	await contract.methods.offerPunkForSale(punkIndex, price).send({from: maker})
	const rawSell = await contract.methods.punksOfferedForSale(punkIndex).call()
	expectEqual(rawSell.isForSale, true, "rawSell.isForSale")
	expectEqual(rawSell.seller.toLowerCase(), maker, "rawSell.seller")
	expectEqual(rawSell.minValue, price.toString(), "rawSell.minValue")
	expectEqual(rawSell.punkIndex, punkIndex.toString(), "rawSell.punkIndex")
	let order = await retry(RETRY_ATTEMPTS, async () => {
		const orders = await getPunkMarketOrders(maker)
		expectLength(orders, 1, "punk market orders count")
		return orders[0]
	})
	printLog(`Created punk market order: ${JSON.stringify(order)}`)
	checkSellOrder(order, ASSET_TYPE_ETH, price, maker)
	return order
}

export async function checkPunkMarketNotForSale(contract: Contract) {
	const forSale = await contract.methods.punksOfferedForSale(punkIndex).call()
	expectEqual(forSale.isForSale, false, "punk is still on sale")
}

/**
 * Request CRYPTO_PUNK sell orders from API.
 */
export async function getPunkMarketOrders(maker: string | undefined): Promise<CryptoPunkOrder[]> {
	return await runLogging(
		`request CRYPTO_PUNK sell orders with maker ${maker}`,
		getApiSellOrdersForPunkByType<CryptoPunkOrder>(ORDER_TYPE_CRYPTO_PUNK, maker)
	)
}

/**
 * Ensure the API does not return any CRYPTO_PUNK sell orders.
 */
export async function checkApiNoMarketOrders() {
	await runLogging(
		"ensure no punk market sell orders in API",
		retry(RETRY_ATTEMPTS, async () => {
			const orders = await getPunkMarketOrders(undefined)
			expectLength(orders, 0, "punk sell orders count")
		})
	)
}

/**
 * Cancel native sell orders, if any. Ensure there are no native sell orders in the API response.
 */
export async function cancelOrderInPunkMarket(maker: string, contract: Contract, throwIfAnotherSeller: boolean = true) {
	const forSale = await contract.methods.punksOfferedForSale(punkIndex).call()
	if (!forSale.isForSale) {
		printLog(`No sell orders found in punk market with maker = ${maker}`)
		return
	}
	if (forSale.seller.toLowerCase() !== maker) {
		let message = `Sell order is from another maker ${maker}`
		if (throwIfAnotherSeller) {
			throw new Error(message)
		}
		printLog(message)
		return
	}
	expectEqual(forSale.seller.toLowerCase(), maker, "seller")
	printLog(`Found sell order in punk market, cancelling it ${forSale}`)
	await contract.methods.punkNoLongerForSale(punkIndex).send({from: maker})
	await checkApiNoMarketOrders()
}
