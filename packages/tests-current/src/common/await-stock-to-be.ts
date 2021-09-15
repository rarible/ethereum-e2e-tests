import { OrderControllerApi } from "@rarible/protocol-api-client"
import { retry } from "./retry"

export async function awaitStockToBe(api: OrderControllerApi, hash: string, value: string | number) {
	await retry(3, async () => {
		const o = await api.getOrderByHash({ hash })
		expect(o.makeStock).toBe(`${value}`)
	})
}
