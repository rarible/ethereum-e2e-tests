import { RaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { retry } from "./retry"
import { Order, OrderStatus } from "@rarible/ethereum-api-client"

export async function verifyOrderStatus(sdk: RaribleSdk, order: Order, status: OrderStatus) {
	await retry(5, async () => {
		const updOrder = await sdk.apis.order.getOrderByHash({hash: order.hash})
		expect(updOrder.status).toBe(status)
		if (status === OrderStatus.CANCELLED) {
			expect(updOrder.cancelled).toBe(true)
		}
	})
}
