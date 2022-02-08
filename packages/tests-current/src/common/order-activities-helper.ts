import { RaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { retry } from "./retry"
import { OrderActivityFilterByItemTypes } from "@rarible/ethereum-api-client"
import { toAddress, toBigNumber } from "@rarible/types"
import { Contract } from "web3-eth-contract"

export async function verifyOrderActivities(sdk: RaribleSdk, contract: Contract, tokenId: string,
																						expectedActivities: Map<OrderActivityFilterByItemTypes, number>) {
	await retry(5, async () => {
		const expectedOrderActivities: Array<OrderActivityFilterByItemTypes> = Array.from(expectedActivities.keys())
		const a = await sdk.apis.orderActivity.getOrderActivities({
			orderActivityFilter: {
				"@type": "by_item",
				contract: toAddress(contract.options.address),
				tokenId: toBigNumber(tokenId),
				types: expectedOrderActivities,
			},
		})

		const orderActivities = Object.values(OrderActivityFilterByItemTypes).filter((item) => {
			return isNaN(Number(item));
		});

		orderActivities.forEach(o => {
			let count = 0
			if (expectedOrderActivities.includes(o)) {
				count = Number(expectedActivities.get(o))
			}
			expect(a.items.filter(a => a["@type"] === o.toString().toLowerCase())).toHaveLength(count)
		})
	})
}
