import { RaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { retry } from "../retry"

export async function verifyMinted(sdk: RaribleSdk, tokenId: string) {
	retry(3, async () => {
		expect((await sdk.apis.nftItem.getNftItemById({ itemId: tokenId })).id.toLowerCase()).toStrictEqual(tokenId.toLowerCase())
	})
}
