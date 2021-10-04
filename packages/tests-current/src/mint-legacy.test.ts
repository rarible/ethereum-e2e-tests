import { toAddress } from "@rarible/types"
import { createRaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { Web3Ethereum } from "@rarible/web3-ethereum"
import { ERC1155VersionEnum, ERC721VersionEnum } from "@rarible/protocol-ethereum-sdk/build/nft/contracts/domain"
import { verifyMinted } from "./common/verify-minted"
import { initProvider } from "./common/init-providers"

describe("mint legacy test", function () {
	const { web3 } = initProvider()

	const sdk = createRaribleSdk(new Web3Ethereum({ web3: web3 }), "e2e")

	const erc721Address = toAddress("0x87ECcc03BaBC550c919Ad61187Ab597E9E7f7C21")
	const erc1155Address = toAddress("0x8812cFb55853da0968a02AaaEA84CD93EC4b42A1")

	test("should mint legacy ERC721 token", async () => {

		const mintResponse = await sdk.nft.mint({
			collection: {
				type: "ERC721",
				id: erc721Address,
				supportsLazyMint: false,

				features: ["SECONDARY_SALE_FEES"],
				// features: ["SECONDARY_SALE_FEES", "MINT_AND_TRANSFER"],
				name: "Test-collection",
				version: ERC721VersionEnum.ERC721V2,
			},
			uri: '//testUri',
			royalties: [],
		})
		await verifyMinted(sdk, mintResponse.itemId)

	}, 50000)

	test("should mint legacy ERC1155 token", async () => {

		const mintResponse = await sdk.nft.mint({
			collection: {
				type: "ERC1155",
				id: erc1155Address,
				supportsLazyMint: false,

				features: ["SECONDARY_SALE_FEES"],
				name: "Test-collection",
				version: ERC1155VersionEnum.ERC1155V1,
			},
			uri: '//testUri',
			royalties: [],
			supply: 100,
		})
		await verifyMinted(sdk, mintResponse.itemId)
	})
})
