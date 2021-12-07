import {NftOwnership} from "@rarible/ethereum-api-client"
import {apiSdk, RETRY_ATTEMPTS} from "../cryptoPunks/util"
import {getOwnershipId} from "./get-ownership-id"
import {retry} from "./retry"

export async function awaitOwnershipValueToBe(
	token: string,
	tokenId: number,
	owner: string,
	value: string | number
) {
	const ownershipId = getOwnershipId(token, tokenId, owner)
	await retry(RETRY_ATTEMPTS, async () => {
		const ownershipResponse = await apiSdk.apis.nftOwnership.getNftOwnershipByIdRaw({ ownershipId })
		expect(ownershipResponse).toHaveProperty("status", 200)
		expect(ownershipResponse.value as NftOwnership).toHaveProperty("value", `${value}`)
	})
}
