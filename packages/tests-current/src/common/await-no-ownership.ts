import {apiSdk, RETRY_ATTEMPTS} from "../cryptoPunks/util"
import {retry} from "./retry"
import {getOwnershipId} from "./get-ownership-id"

export async function awaitNoOwnership(
	token: string,
	tokenId: number,
	owner: string
) {
	const ownershipId = getOwnershipId(token, tokenId, owner)
	await retry(RETRY_ATTEMPTS, async () => {
		const ownershipResponse = await apiSdk.apis.nftOwnership.getNftOwnershipByIdRaw({ ownershipId })
		expect(ownershipResponse).toHaveProperty("status", 404)
	})
}
