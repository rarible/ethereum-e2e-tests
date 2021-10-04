import { toAddress } from "@rarible/types"
import { createRaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { Web3Ethereum } from "@rarible/web3-ethereum"
import { ERC1155VersionEnum, ERC721VersionEnum } from "@rarible/protocol-ethereum-sdk/build/nft/contracts/domain"
import { deployTestErc721 } from "./contracts/test-erc721"
import { awaitAll } from "./common/await-all"
import { verifyMinted } from "./common/verify-minted"
import { deployTestErc1155 } from "./contracts/test-erc1155"
import { initProvider } from "./common/init-providers"

describe("lazy-mint test", function () {
	const { web3, wallet } = initProvider()

	const sdk = createRaribleSdk(new Web3Ethereum({ web3: web3 }), "e2e")

	const conf = awaitAll({
		testErc721: deployTestErc721(web3),
		testErc1155: deployTestErc1155(web3),
	})

	test("should create lazy mint ERC721 token", async () => {

		const mintResponse = await sdk.nft.mint({
			collection: {
				features: ["SECONDARY_SALE_FEES", "MINT_AND_TRANSFER"],
				id: toAddress(conf.testErc721.options.address),
				name: "Test-collection",
				type: "ERC721",
				supportsLazyMint: true,
				version: ERC721VersionEnum.ERC721V3,
			},
			uri: '//testUri',
			creators: [{ account: toAddress(wallet.getAddressString()), value: 10000 }],
			royalties: [],
			lazy: true,
		})
		await verifyMinted(sdk, mintResponse.itemId)
	})

	test("should create lazy mint ERC1155 token", async () => {

		const mintResponse = await sdk.nft.mint({
			collection: {
				features: ["MINT_AND_TRANSFER"],
				id: toAddress(conf.testErc721.options.address),
				name: "Test-collection",
				type: "ERC1155",
				supportsLazyMint: true,
				version: ERC1155VersionEnum.ERC1155V2,
			},
			uri: '//testUri',
			creators: [{ account: toAddress(wallet.getAddressString()), value: 10000 }],
			royalties: [],
			supply: 100,
			lazy: true,
		})
		await verifyMinted(sdk, mintResponse.itemId)
	})
})