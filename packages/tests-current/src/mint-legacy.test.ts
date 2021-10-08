import { toAddress } from "@rarible/types"
import { createRaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { Web3Ethereum } from "@rarible/web3-ethereum"
import { createErc1155V1Collection, createErc721V2Collection } from "@rarible/protocol-ethereum-sdk/build/common/mint"
import { verifyMinted } from "./common/verify-minted"
import { initProvider } from "./common/init-providers"

describe("mint legacy test", function () {
	const { web3 } = initProvider()

	const sdk = createRaribleSdk(new Web3Ethereum({ web3: web3 }), "e2e")

	const erc721Address = toAddress("0x87ECcc03BaBC550c919Ad61187Ab597E9E7f7C21")
	const erc1155Address = toAddress("0x8812cFb55853da0968a02AaaEA84CD93EC4b42A1")

	test("should mint legacy ERC721 token", async () => {

		const mintResponse = await sdk.nft.mint({
			collection: createErc721V2Collection(erc721Address),
			uri: "//testUri",
			royalties: [],
		})
		await verifyMinted(sdk, mintResponse.itemId)

	}, 50000)

	test("should mint legacy ERC1155 token", async () => {

		const mintResponse = await sdk.nft.mint({
			collection: createErc1155V1Collection(erc1155Address),
			uri: "//testUri",
			royalties: [],
			supply: 100,
		})
		await verifyMinted(sdk, mintResponse.itemId)
	})
})
