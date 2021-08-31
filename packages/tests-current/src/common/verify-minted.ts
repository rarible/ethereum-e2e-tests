import { RaribleSdk } from "@rarible/protocol-ethereum-sdk"

export async function verifyMinted(sdk: RaribleSdk, tokenId: string) {
	expect((await sdk.apis.nftItem.getNftItemById({ itemId: tokenId })).id.toLowerCase()).toStrictEqual(tokenId.toLowerCase())
}
