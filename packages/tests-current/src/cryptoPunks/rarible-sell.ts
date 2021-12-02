import {EthAssetType, RaribleV2Order} from "@rarible/ethereum-api-client"
import {Erc20AssetType} from "@rarible/ethereum-api-client/build/models"
import {RaribleSdk} from "@rarible/protocol-ethereum-sdk"
import {toAddress} from "@rarible/types"
import {retry} from "../common/retry"
import {expectEqual, expectLength} from "../common/expect-equal"
import {printLog, RETRY_ATTEMPTS, runLogging} from "./util"
import {ASSET_TYPE_CRYPTO_PUNK, ORDER_TYPE_RARIBLE_V2} from "./crypto-punks"
import {checkSellOrder, getApiSellOrdersForPunkByType} from "./common-sell"

/**
 * Request RaribleV2 sell orders from API.
 */
export async function getRariblePunkSellOrders(maker: string | undefined): Promise<RaribleV2Order[]> {
	return await runLogging(
		`request RaribleV2 punk sell orders from ${maker}`,
		getApiSellOrdersForPunkByType<RaribleV2Order>(ORDER_TYPE_RARIBLE_V2, maker)
	)
}

/**
 * Creates RARIBLE_V2 sell order for punk.
 */
export async function createRaribleSellOrder(
	maker: string,
	takeAssetType: EthAssetType | Erc20AssetType,
	price: number,
	sdk: RaribleSdk
): Promise<RaribleV2Order> {
	let isErc20 = "contract" in takeAssetType
	let sellOrder = await runLogging(
		`create ${isErc20 ? "ERC20" : "ETH"} sell order with price ${price}`,
		sdk.order.sell({
			makeAssetType: ASSET_TYPE_CRYPTO_PUNK,
			amount: 1,
			maker: toAddress(maker),
			originFees: [],
			payouts: [],
			price: price,
			takeAssetType: takeAssetType,
		}).then((order) => order as RaribleV2Order)
	)
	checkSellOrder(sellOrder, takeAssetType, price, maker)
	await checkApiRaribleSellOrderExists(maker, price)
	printLog(`Created sell order: ${JSON.stringify(sellOrder)}`)
	return sellOrder
}

/**
 * Ensure the API returns Rarible punk sell order.
 */
export async function checkApiRaribleSellOrderExists(maker: string, price: number): Promise<RaribleV2Order> {
	return runLogging(
		`Check sell order from ${maker} with price ${price}`,
		retry(RETRY_ATTEMPTS, async () => {
			const sellOrders = await getRariblePunkSellOrders(maker)
			expectLength(sellOrders, 1, `sell orders from ${maker}`)
			let sellOrder = sellOrders[0]
			expectEqual(sellOrder.take.value, price.toString(), `sell price: ${JSON.stringify(sellOrder)}`)
			return sellOrder
		})
	)
}

/**
 * Ensure the API does not return any RARIBLE_V2 sell orders.
 */
export async function checkApiNoRaribleSellOrders() {
	await runLogging(
		"ensure no rarible orders in API",
		retry(RETRY_ATTEMPTS, async () => {
			const sellOrders = await getRariblePunkSellOrders(undefined)
			expectLength(sellOrders, 0, "rarible sell orders count")
		})
	)
}

/**
 * Cancels Rarible sell orders via API.
 */
export async function cancelRaribleSellOrders(
	sdk: RaribleSdk,
	maker: string
) {
	const orders = await getRariblePunkSellOrders(maker)
	if (orders.length === 0) {
		printLog(`No Rarible sell orders to cancel from ${maker}`)
		return
	}
	printLog(`orders to cancel from ${maker}: ${orders.length}: ${JSON.stringify(orders)}`)

	for (const order of orders) {
		await runLogging(
			`cancel sell order ${order}`,
			sdk.order.cancel(order)
		)
	}

	await checkApiNoRaribleSellOrders()
}
