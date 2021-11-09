import {NftItem} from "@rarible/ethereum-api-client/build/models"
import {RaribleSdk} from "@rarible/protocol-ethereum-sdk"
import {toAddress} from "@rarible/types"
import {retry} from "./retry"

export async function verifyErc1155Owner(sdk: RaribleSdk, tokenId: string, owner: string) {

	const nftItem: NftItem  = await retry(10, () => {
		return sdk.apis.nftItem.getNftItemById({ itemId: tokenId})
	})
	expect(nftItem.owners.includes(toAddress(owner))).toBeTruthy()
}
