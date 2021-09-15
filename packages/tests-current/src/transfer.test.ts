import { createRaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { toAddress, toBigNumber } from "@rarible/types"
import { Web3Ethereum } from "@rarible/web3-ethereum"
import { deployTestErc721, erc721Mint } from "./contracts/test-erc721"
import { awaitAll } from "./common/await-all"
import { verifyErc721Balance } from "./common/verify-erc721-balance"
import { deployTestErc1155, erc1155Mint } from "./contracts/test-erc1155"
import { verifyErc1155Balance } from "./common/verify-erc1155-balance"
import { initProviders } from "./common/init-providers"

describe("transfer test", function () {
	const { web31, wallet1, wallet2 } = initProviders({})
	const sdk1 = createRaribleSdk(new Web3Ethereum({ web3: web31 }), "e2e")

	const conf = awaitAll({
		testErc721: deployTestErc721(web31),
		testErc1155: deployTestErc1155(web31),
	})

	test("test-erc721 transfer", async () => {
		await erc721Mint(conf.testErc721, wallet1.getAddressString(), wallet1.getAddressString(), 1)

		await sdk1.nft.transfer({
				assetClass: "ERC721",
				contract: toAddress(conf.testErc721.options.address),
				tokenId: toBigNumber('1'),
			},
			toAddress(wallet2.getAddressString()),
		)

		await verifyErc721Balance(conf.testErc721, wallet2.getAddressString(), 1)
	}, 30000)
	test("test-erc1155 transfer", async () => {
		await erc1155Mint(conf.testErc1155, wallet1.getAddressString(), wallet1.getAddressString(), 1, 100)

		await sdk1.nft.transfer({
				assetClass: "ERC1155",
				contract: toAddress(conf.testErc1155.options.address),
				tokenId: toBigNumber('1'),
			},
			toAddress(wallet2.getAddressString()),
			toBigNumber('50'),
		)

		await verifyErc1155Balance(conf.testErc1155, wallet2.getAddressString(), '1', 50)
	})
})
