import {apiSdk, RETRY_ATTEMPTS} from "../cryptoPunks/util"
import {retry} from "./retry"
import {getOwnershipId} from "./get-ownership-id"
import {expectEqual} from "./expect-equal"

export async function awaitNoOwnership(
	token: string,
	tokenId: number,
	owner: string
) {
	const ownershipId = getOwnershipId(token, tokenId, owner)
	await retry(RETRY_ATTEMPTS, async () => {
		const ownershipResponse = await apiSdk.apis.nftOwnership.getNftOwnershipByIdRaw({ ownershipId })
		expectEqual(ownershipResponse.status, 404, "expected Not found ownership. ownership status")
	})
}
