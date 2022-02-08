import { createRaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { randomAddress } from "@rarible/types"
import { Web3Ethereum } from "@rarible/web3-ethereum"
import { deployTestErc721, erc721Mint } from "../contracts/test-erc721"
import { retry } from "../common/retry"
import { awaitAll } from "../common/await-all"
import { initProvider } from "../common/init-providers"

describe("Index minted", function () {
	const { web3, wallet } = initProvider()
	const sdk = createRaribleSdk(new Web3Ethereum({ web3 }), "e2e")

	const conf = awaitAll({
		testErc721: deployTestErc721(web3),
	})

	test("simple test ERC721 is indexed", async () => {
		await erc721Mint(conf.testErc721, wallet.getAddressString(), randomAddress(), 1)
		const itemId = `${conf.testErc721.options.address}:1`

		await retry(30, () => {
			return sdk.apis.nftItem.getNftItemById({ itemId })
		})
	})
})
