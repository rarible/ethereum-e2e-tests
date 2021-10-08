import { toAddress } from "@rarible/types"
import { createRaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { Web3Ethereum } from "@rarible/web3-ethereum"
import { createErc1155V2Collection, createErc721V3Collection } from "@rarible/protocol-ethereum-sdk/build/common/mint"
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
			collection: createErc721V3Collection(toAddress(conf.testErc721.options.address)),
			uri: "//testUri",
			creators: [{ account: toAddress(wallet.getAddressString()), value: 10000 }],
			royalties: [],
			lazy: true,
		})
		await verifyMinted(sdk, mintResponse.itemId)
	})

	test("should create lazy mint ERC1155 token", async () => {

		const mintResponse = await sdk.nft.mint({
			collection: createErc1155V2Collection(toAddress(conf.testErc721.options.address)),
			uri: "//testUri",
			creators: [{ account: toAddress(wallet.getAddressString()), value: 10000 }],
			royalties: [],
			supply: 100,
			lazy: true,
		})
		await verifyMinted(sdk, mintResponse.itemId)
	})
})
