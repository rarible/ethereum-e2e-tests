import {NftOwnershipControllerApi} from "@rarible/ethereum-api-client"
import {getOwnershipId} from "./get-ownership-id"
import {retry} from "./retry"

export async function awaitOwnershipValueToBe(
	api: NftOwnershipControllerApi,
	token: string,
	tokenId: Number,
	owner: string,
	value: string | number
) {
	const ownershipId = getOwnershipId(token, tokenId, owner)
	await retry(3, async () => {
		const o = await api.getNftOwnershipById({ownershipId})
		expect(o.value).toBe(`${value}`)
	})
}