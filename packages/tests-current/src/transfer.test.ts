import { createRaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { toAddress, toBigNumber } from "@rarible/types"
import { Web3Ethereum } from "@rarible/web3-ethereum"
import { deployTestErc721, erc721Mint } from "./contracts/test-erc721"
import { awaitAll } from "./common/await-all"
import { verifyErc721Balance } from "./common/verify-erc721-balance"
import { createErc1155EthereumContract, deployTestErc1155, erc1155Mint } from "./contracts/test-erc1155"
import { verifyErc1155Balance } from "./common/verify-erc1155-balance"
import { initProviders } from "./common/init-providers"

describe("transfer test", function () {
	const { web31, wallet1, wallet2 } = initProviders({})
	const ethereum1 = new Web3Ethereum({ web3: web31 })
	const sdk1 = createRaribleSdk(ethereum1, "e2e")

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
		const erc1155Contract = createErc1155EthereumContract(ethereum1, toAddress(conf.testErc1155.options.address))

		const mintTx = await erc1155Mint(erc1155Contract, wallet1.getAddressString(), wallet1.getAddressString(), 1, 100)
		await mintTx.wait()

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
