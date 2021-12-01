import {EthAssetType, RaribleV2Order} from "@rarible/ethereum-api-client"
import {Erc20AssetType} from "@rarible/ethereum-api-client/build/models"
import {RaribleSdk} from "@rarible/protocol-ethereum-sdk"
import {toAddress} from "@rarible/types"
import {retry} from "../common/retry"
import {expectLength} from "../common/expect-equal"
import {printLog, RETRY_ATTEMPTS, runLogging} from "./util"
import {ASSET_TYPE_CRYPTO_PUNK, ORDER_TYPE_RARIBLE_V2} from "./crypto-punks"
import {checkSellOrder, getInactiveOrdersForPunkByType, getOrdersForPunkByType} from "./common-sell"

/**
 * Request RaribleV2 sell orders from API.
 */
export async function getRariblePunkOrders(maker: string | undefined): Promise<RaribleV2Order[]> {
	return await runLogging(
		"request RaribleV2 punk sell orders",
		getOrdersForPunkByType<RaribleV2Order>(ORDER_TYPE_RARIBLE_V2, maker)
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
	await retry(RETRY_ATTEMPTS, async () => {
		const orders = await getRariblePunkOrders(maker)
		expectLength(orders, 1, "rarible order before bid")
	})
	printLog(`created sell order: ${JSON.stringify(sellOrder)}`)
	return sellOrder
}

/**
 * Ensure the API does not return any RARIBLE_V2 sell orders.
 */
export async function checkApiNoRaribleOrders() {
	await runLogging(
		"ensure no rarible orders in API",
		retry(RETRY_ATTEMPTS, async () => {
			const bids = await getRariblePunkOrders(undefined)
			expectLength(bids, 0, "rarible sell orders count")
		})
	)
}

/**
 * Cancels Rarible sell orders via API.
 */
export async function cancelRaribleOrders(
	sdk: RaribleSdk,
	maker: string
) {
	const orders = await getRariblePunkOrders(maker)
	if (orders.length === 0) {
		printLog("No Rarible sell orders to cancel")
		return
	}
	printLog(`orders to cancel from ${maker}: ${orders.length}: ${JSON.stringify(orders)}`)

	for (const order of orders) {
		await runLogging(
			`cancel sell order ${order}`,
			sdk.order.cancel(order)
		)
	}

	await checkApiNoRaribleOrders()
}

/**
 * Request INACTIVE RaribleV2 sell orders from API.
 */
export async function getInactiveRaribleOrders(maker: string): Promise<RaribleV2Order[]> {
	return await runLogging(
		"request INACTIVE RaribleV2 sell orders",
		getInactiveOrdersForPunkByType(maker, ORDER_TYPE_RARIBLE_V2)
	)
}
