import { toAddress } from "@rarible/types"
import { createRaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { Web3Ethereum } from "@rarible/web3-ethereum"
import { ERC1155VersionEnum, ERC721VersionEnum } from "@rarible/protocol-ethereum-sdk/build/nft/contracts/domain"
import { verifyMinted } from "./common/verify-minted"
import { initProvider } from "./common/init-providers"

describe("mint test", function () {
	const { web3, wallet } = initProvider()

	const sdk = createRaribleSdk(new Web3Ethereum({ web3: web3 }), "e2e")

	const erc721Address = toAddress("0x22f8CE349A3338B15D7fEfc013FA7739F5ea2ff7")
	const erc1155Address = toAddress("0x268dF35c389Aa9e1ce0cd83CF8E5752b607dE90d")

	test("should mint ERC721 token", async () => {
		const mintResponse = await sdk.nft.mint({
			collection: {
				features: ["SECONDARY_SALE_FEES", "MINT_AND_TRANSFER"],
				id: erc721Address,
				name: "Test-collection",
				type: "ERC721",
				supportsLazyMint: true,
				version: ERC721VersionEnum.ERC721V3,
			},
			uri: "uri",
			creators: [{ account: toAddress(wallet.getAddressString()), value: 10000 }],
			royalties: [],
			lazy: false,
		})
		await verifyMinted(sdk, mintResponse.itemId)

	}, 50000)

	test("should mint ERC1155 token", async () => {

		const mintResponse = await sdk.nft.mint({
			collection: {
				features: ["MINT_AND_TRANSFER"],
				id: erc1155Address,
				name: "Test-collection",
				type: "ERC1155",
				supportsLazyMint: true,
				version: ERC1155VersionEnum.ERC1155V2,
			},
			uri: '//testUri',
			supply: 100,
			creators: [{ account: toAddress(wallet.getAddressString()), value: 10000 }],
			royalties: [],
			lazy: false,

		})
		await verifyMinted(sdk, mintResponse.itemId)
	})
})
