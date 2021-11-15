import { createRaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { toAddress, toBigNumber } from "@rarible/types"
import { Web3Ethereum } from "@rarible/web3-ethereum"
import { deployTestErc721, erc721Mint } from "./contracts/test-erc721"
import { awaitAll } from "./common/await-all"
import { createErc1155EthereumContract, deployTestErc1155, erc1155Mint } from "./contracts/test-erc1155"
import { awaitOwnershipValueToBe } from "./common/await-ownership-value-to-be"
import { awaitNoOwnership } from "./common/await-no-ownership"
import { initProviders } from "./common/init-providers"

describe("transfer test", function () {
	const { web31, wallet1, wallet2 } = initProviders({})
	const wallet1Address = wallet1.getAddressString()
	const wallet2Address = wallet2.getAddressString()
	const ethereum1 = new Web3Ethereum({ web3: web31 })
	const sdk1 = createRaribleSdk(ethereum1, "e2e")
	const nftOwnership = sdk1.apis.nftOwnership

	const conf = awaitAll({
		testErc721: deployTestErc721(web31),
		testErc1155: deployTestErc1155(web31),
	})

	const tokenId = 1

	test("test-erc721 transfer", async () => {
		await erc721Mint(conf.testErc721, wallet1Address, wallet1Address, tokenId)

		let erc721Address = conf.testErc721.options.address
		await sdk1.nft.transfer(
			{
				assetClass: "ERC721",
				contract: toAddress(erc721Address),
				tokenId: toBigNumber(tokenId.toString()),
			},
			toAddress(wallet2Address)
		)

		await awaitNoOwnership(nftOwnership, erc721Address, tokenId, wallet1Address)
		await awaitOwnershipValueToBe(nftOwnership, erc721Address, tokenId, wallet2Address, 1)
	}, 30000)

	test("test-erc1155 transfer", async () => {
		let erc1155Address = conf.testErc1155.options.address
		const erc1155Contract = createErc1155EthereumContract(ethereum1, toAddress(erc1155Address))

		const mintTx = await erc1155Mint(erc1155Contract, wallet1Address, wallet1Address, tokenId, 100)
		await mintTx.wait()

		await sdk1.nft.transfer(
			{
				assetClass: "ERC1155",
				contract: toAddress(erc1155Address),
				tokenId: toBigNumber(tokenId.toString()),
			},
			toAddress(wallet2Address),
			toBigNumber("60"),
		)

		await awaitOwnershipValueToBe(nftOwnership, erc1155Address, tokenId, wallet1Address, 40)
		await awaitOwnershipValueToBe(nftOwnership, erc1155Address, tokenId, wallet2Address, 60)
	})
})
