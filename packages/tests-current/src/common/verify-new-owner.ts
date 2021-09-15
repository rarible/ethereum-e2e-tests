import { RaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { Address } from "@rarible/protocol-api-client"
import { retry } from "./retry"

export async function verifyNewOwner(sdk: RaribleSdk, tokenId: string, expectedOwner: Address) {
	await retry(3, async () => {
		expect((await sdk.apis.nftItem.getNftItemById({ itemId: tokenId })).owners.includes(expectedOwner)).toBeTruthy()
	})
}
