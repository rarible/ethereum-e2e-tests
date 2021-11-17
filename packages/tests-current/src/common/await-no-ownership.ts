import { NftOwnershipControllerApi } from "@rarible/ethereum-api-client"
import { retry } from "./retry"
import { getOwnershipId } from "./get-ownership-id"
import { expectEqual } from "./expect-equal"

export async function awaitNoOwnership(
	api: NftOwnershipControllerApi,
	token: string,
	tokenId: Number,
	owner: string
) {
	const ownershipId = getOwnershipId(token, tokenId, owner)
	await retry(3, async () => {
		const ownershipResponse = await api.getNftOwnershipByIdRaw({ ownershipId })
		expectEqual(ownershipResponse.status, 404, "expected Not found ownership. ownership status")
	})
}
