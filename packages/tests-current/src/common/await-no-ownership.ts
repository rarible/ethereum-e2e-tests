import { NftOwnershipControllerApi } from "@rarible/ethereum-api-client"
import { retry } from "./retry"
import { getOwnershipId } from "./get-ownership-id"

export async function awaitNoOwnership(
	api: NftOwnershipControllerApi,
	token: string,
	tokenId: Number,
	owner: string
) {
	const ownershipId = getOwnershipId(token, tokenId, owner)
	await retry(3, async () => {
		let ownership = await api.getNftOwnershipByIdRaw({ ownershipId })
		expect(ownership.status).toBe(404)
	})
}
