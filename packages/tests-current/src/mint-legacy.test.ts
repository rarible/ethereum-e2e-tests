import { toAddress } from "@rarible/types"
import { createRaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { Web3Ethereum } from "@rarible/web3-ethereum"
import { verifyMinted } from "./common/verify-minted"
import { initProvider } from "./common/init-providers"

describe("mint legacy test", function () {
	const { web3 } = initProvider()

	const sdk = createRaribleSdk(new Web3Ethereum({ web3: web3 }), "e2e")

	const erc721Address = toAddress("0x87ECcc03BaBC550c919Ad61187Ab597E9E7f7C21")
	const erc1155Address = toAddress("0x8812cFb55853da0968a02AaaEA84CD93EC4b42A1")

	test("should mint legacy ERC721 token", async () => {

		const itemId = await sdk.nft.mint({
			collection: {
				type: "ERC721",
				id: erc721Address,
				supportsLazyMint: false,
			},
			uri: '//testUri',
			royalties: [],
		})
		await verifyMinted(sdk, itemId)

	}, 50000)

	test("should mint legacy ERC1155 token", async () => {

		const itemId = await sdk.nft.mint({
			collection: {
				type: "ERC1155",
				id: erc1155Address,
				supportsLazyMint: false,
			},
			uri: '//testUri',
			royalties: [],
			supply: 100,
		})
		await verifyMinted(sdk, itemId)
	})
})
