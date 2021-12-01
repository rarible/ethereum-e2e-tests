import {EthAssetType, RaribleV2Order} from "@rarible/ethereum-api-client"
import {Erc20AssetType} from "@rarible/ethereum-api-client/build/models"
import {RaribleSdk} from "@rarible/protocol-ethereum-sdk"
import {toAddress} from "@rarible/types"
import {retry} from "../common/retry"
import {expectLength} from "../common/expect-equal"
import {printLog, runLogging} from "./util"
import {ASSET_TYPE_CRYPTO_PUNK, ORDER_TYPE_RARIBLE_V2} from "./crypto-punks"
import {checkSellOrder, getInactiveOrdersForPunkByType, getOrdersForPunkByType} from "./common-sell"

/**
 * Request RaribleV2 sell orders from API.
 */
export async function getRariblePunkOrders(sdk: RaribleSdk, maker: string | undefined): Promise<RaribleV2Order[]> {
	return await runLogging(
		"request RaribleV2 punk sell orders",
		getOrdersForPunkByType<RaribleV2Order>(sdk, ORDER_TYPE_RARIBLE_V2, maker)
	)
}

/**
 * Creates RARIBLE_V2 sell order for punk.
 */
export async function createRaribleSellOrder(
	takeAssetType: EthAssetType | Erc20AssetType,
	price: number,
	maker: string,
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
	await retry(3, async () => {
		const orders = await getRariblePunkOrders(sdk, maker)
		expectLength(orders, 1, "rarible order before bid")
	})
	printLog(`created sell order: ${JSON.stringify(sellOrder)}`)
	return sellOrder
}

/**
 * Ensure the API does not return any RARIBLE_V2 sell orders.
 */
export async function checkApiNoRaribleOrders(sdk: RaribleSdk) {
	await runLogging(
		"ensure no rarible orders in API",
		retry(3, async () => {
			const bids = await getRariblePunkOrders(sdk, undefined)
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
	const orders = await getRariblePunkOrders(sdk, maker)
	if (orders.length === 0) {
		printLog("No Rarible sell orders to cancel")
		return
	}
	printLog(`orders to cancel ${orders.length}: ${JSON.stringify(orders)}`)

	for (const order of orders) {
		await runLogging(
			`cancel sell order ${order}`,
			sdk.order.cancel(order)
		)
	}

	await checkApiNoRaribleOrders(sdk)
}

/**
 * Request INACTIVE RaribleV2 sell orders from API.
 */
export async function getInactiveRaribleOrders(sdk: RaribleSdk, maker: string): Promise<RaribleV2Order[]> {
	return await runLogging(
		"request INACTIVE RaribleV2 sell orders",
		getInactiveOrdersForPunkByType(sdk, maker, ORDER_TYPE_RARIBLE_V2)
	)
}
