import { createRaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { randomAddress } from "@rarible/types"
import fetch from "node-fetch"
import { Web3Ethereum } from "@rarible/web3-ethereum"
import { createE2eProvider } from "./common/create-e2e-provider"
import { deployTestErc721, erc721Mint } from "./contracts/test-erc721"
import { retry } from "./retry"
import { awaitAll } from "./common/await-all"

describe("Index minted", function () {
	const { web3, wallet } = createE2eProvider()
	const sdk = createRaribleSdk(new Web3Ethereum({ web3 }), "e2e", { fetchApi: fetch })

	const conf = awaitAll({
		testErc721: deployTestErc721(web3),
	})

	test("simple test ERC721 is indexed", async () => {
		await erc721Mint(conf.testErc721, wallet.getAddressString(), randomAddress(), 1, "https://example.com")
		const itemId = `${conf.testErc721.options.address}:1`

		await retry(30, () => {
			return sdk.apis.nftItem.getNftItemById({ itemId })
		})
	}, 10000)
})
