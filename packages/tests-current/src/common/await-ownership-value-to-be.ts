import { NftOwnershipControllerApi, NftOwnership } from "@rarible/ethereum-api-client"
import { getOwnershipId } from "./get-ownership-id"
import { retry } from "./retry"
import { expectEqual } from "./expect-equal"

export async function awaitOwnershipValueToBe(
	api: NftOwnershipControllerApi,
	token: string,
	tokenId: Number,
	owner: string,
	value: string | number
) {
	const ownershipId = getOwnershipId(token, tokenId, owner)
	await retry(3, async () => {
		const ownershipResponse = await api.getNftOwnershipByIdRaw({ ownershipId })
		expectEqual(ownershipResponse.status, 200, "ownership status")
		expectEqual((ownershipResponse.value as NftOwnership).value, `${value}`, "ownership value")
	})
}