import {RaribleSdk} from "@rarible/protocol-ethereum-sdk"
import {SimpleCryptoPunkOrder, SimpleRaribleV2Order} from "@rarible/protocol-ethereum-sdk/build/order/types"
import {
	CryptoPunksOrderFillRequest,
	RaribleV2OrderFillRequest,
} from "@rarible/protocol-ethereum-sdk/build/order/fill-order/types"
import {runLogging} from "./util"

export async function fillOrder(
	order: SimpleCryptoPunkOrder | SimpleRaribleV2Order,
	sdk: RaribleSdk
) {
	let request: CryptoPunksOrderFillRequest | RaribleV2OrderFillRequest
	if (order.type === "CRYPTO_PUNK") {
		request = {
			order: order,
			amount: 1,
		} as CryptoPunksOrderFillRequest
	} else {
		request = {
			order: order,
			amount: 1,
		} as RaribleV2OrderFillRequest
	}
	await runLogging(`fill order ${JSON.stringify(order)}`,
		sdk.order.fill(request)
	)
}
