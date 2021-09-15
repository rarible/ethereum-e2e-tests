import { RaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { retry } from "./retry"

export async function verifyMinted(sdk: RaribleSdk, tokenId: string) {
	await retry(3, async () => {
		await sdk.apis.nftItem.getNftItemById({ itemId: tokenId })
	})
}
