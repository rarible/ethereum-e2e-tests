import fetch from "node-fetch"
import { toAddress, toBigNumber } from "@rarible/types"
import { createRaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { Web3Ethereum } from "@rarible/web3-ethereum"
import { createE2eProvider } from "./common/create-e2e-provider"
import { deployTestErc721 } from "./contracts/test-erc721"
import { awaitAll } from "./common/await-all"
import { verifyMinted } from "./common/verify-minted"
import { deployTestErc1155 } from "./contracts/test-erc1155"

describe("lazy-mint test", function () {
	const { web3, wallet } = createE2eProvider()

	const sdk = createRaribleSdk(new Web3Ethereum({ web3: web3 }), "e2e", { fetchApi: fetch })

	const conf = awaitAll({
		testErc721: deployTestErc721(web3),
		testErc1155: deployTestErc1155(web3),
	})

	test("should create lazy mint ERC721 token", async () => {

		const item = await sdk.nft.mintLazy({
			"@type": "ERC721",
			contract: toAddress(conf.testErc721.options.address),
			uri: '//testUri',
			creators: [{ account: toAddress(wallet.getAddressString()), value: 10000 }],
			royalties: [],
		})
		await verifyMinted(sdk, item.id, item)

	}, 50000)

	test("should create lazy mint ERC1155 token", async () => {

		const item = await sdk.nft.mintLazy({
			"@type": "ERC1155",
			contract: toAddress(conf.testErc721.options.address),
			uri: '//testUri',
			creators: [{ account: toAddress(wallet.getAddressString()), value: 10000 }],
			royalties: [],
			supply: toBigNumber('100'),
		})
		await verifyMinted(sdk, item.id, item)

	}, 50000)
})
