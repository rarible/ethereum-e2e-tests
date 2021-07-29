import { createRaribleSdk } from "@rarible/protocol-ethereum-sdk/build"
import { randomAddress } from "@rarible/types"
import fetch from "node-fetch"
import { Contract } from "web3-eth-contract"
import { createE2eProvider } from "./create-e2e-provider"
import { deployTestErc721 } from "./contracts/test-erc721"
import { retry } from "./retry"

describe("Index minted", function() {
	const { web3, wallet } = createE2eProvider()
	const sdk = createRaribleSdk(web3, "e2e", { fetchApi: fetch })

	let testErc721: Contract

	beforeAll(async () => {
		testErc721 = await deployTestErc721(web3, "test", "test")
	})

	test("simple test ERC721 is indexed", async () => {
		await testErc721.methods.mint(randomAddress(), 1, 'https://example.com').send({ from: wallet.getAddressString(), gas: 500000, gasPrice: 0 })
		const itemId = `${testErc721.options.address}:1`

		await retry(30, () => {
			return sdk.apis.nftItem.getNftItemById({ itemId})
		})
	}, 10000)
})
