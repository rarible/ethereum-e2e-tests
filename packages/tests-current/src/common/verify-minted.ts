import { NftItem } from "@rarible/protocol-api-client"
import { RaribleSdk } from "@rarible/protocol-ethereum-sdk"

export async function verifyMinted(sdk: RaribleSdk, tokenId: string, expectedItem: NftItem) {
	expect(await sdk.apis.nftItem.getNftItemById({ itemId: tokenId })).toStrictEqual(expectedItem)
}
