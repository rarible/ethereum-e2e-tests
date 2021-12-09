import {Contract} from "web3-eth-contract"
import {CryptoPunkOrder} from "@rarible/ethereum-api-client/build/models/Order"
import {retry} from "../common/retry"
import {checkFieldsOfSellOrder, getApiPunkMarketSellOrders} from "../common/api-sell"
import {ASSET_TYPE_ETH, printLog, RETRY_ATTEMPTS, ZERO_ADDRESS} from "../common/util"

/**
 * Creates sell order from [maker] in the punk market.
 */
export async function createPunkMarketSellOrder(
	punkIndex: number,
	maker: string,
	price: number,
	contract: Contract,
	onlySellTo: string = ZERO_ADDRESS
): Promise<CryptoPunkOrder> {
	if (onlySellTo === ZERO_ADDRESS) {
		await contract.methods.offerPunkForSale(punkIndex, price).send({from: maker})
	} else {
		await contract.methods.offerPunkForSaleToAddress(punkIndex, price, onlySellTo).send({from: maker})
	}
	await checkPunkMarketSellOrderExists(punkIndex, contract, maker, price, onlySellTo)
	let sellOrder = await retry(RETRY_ATTEMPTS, async () => {
		const orders = await getApiPunkMarketSellOrders(punkIndex, maker)
		expect(orders).toHaveLength(1)
		let order = orders[0]
		checkFieldsOfSellOrder(
			order, ASSET_TYPE_ETH, price, maker, onlySellTo === ZERO_ADDRESS ? undefined : onlySellTo
		)
		return order
	})
	printLog(`Created punk market order: ${JSON.stringify(sellOrder)}`)
	return sellOrder
}

export async function checkPunkMarketSellOrderExists(
	punkIndex: number,
	contract: Contract,
	maker: string,
	price: number,
	onlySellTo: string = ZERO_ADDRESS
) {
	const rawSell = await contract.methods.punksOfferedForSale(punkIndex).call()
	expect(rawSell.isForSale).toBe(true)
	expect(rawSell.seller.toLowerCase()).toBe(maker)
	expect(rawSell.minValue).toBe(price.toString())
	expect(rawSell.punkIndex).toBe(punkIndex.toString())
	expect(rawSell.onlySellTo.toLowerCase()).toBe(onlySellTo)
}

export async function checkPunkMarketNotForSale(punkIndex: number, contract: Contract) {
	const forSale = await contract.methods.punksOfferedForSale(punkIndex).call()
	expect(forSale.isForSale).toBe(false)
}
