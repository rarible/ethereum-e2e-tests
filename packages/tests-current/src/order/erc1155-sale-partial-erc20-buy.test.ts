import { createRaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { toAddress, toBigNumber } from "@rarible/types"
import { Web3Ethereum } from "@rarible/web3-ethereum"
import { awaitAll } from "../common/await-all"
import { awaitStockToBe } from "../common/await-stock-to-be"
import { createErc1155EthereumContract, deployTestErc1155, erc1155Mint } from "../contracts/test-erc1155"
import { initProviders } from "../common/init-providers"
import { verifyErc1155Balance } from "../common/verify-erc1155-balance"
import { deployTestErc20, erc20Mint } from "../contracts/test-erc20"

describe("erc1155-sale", function() {
	const { web31, wallet1, wallet2 } = initProviders({})

	const ethereum1 = new Web3Ethereum({ web3: web31 })
	const sdk1 = createRaribleSdk(ethereum1, "e2e")

	const conf = awaitAll({
		testErc20: deployTestErc20(web31),
		testErc1155: deployTestErc1155(web31),
	})

	test("test-erc1155 sell/buy, partial buy using erc-20", async () => {
		const nftSellerAsset = { tokenId: 2, amount: 100 }
		const buyerHasErc20 = 1000
		const erc1155Contract = createErc1155EthereumContract(ethereum1, toAddress(conf.testErc1155.options.address))

		const mint1155Tx = await erc1155Mint(
			erc1155Contract,
			wallet1.getAddressString(),
			wallet1.getAddressString(),
			nftSellerAsset.tokenId,
			nftSellerAsset.amount,
		)
		await mint1155Tx.wait()

		await erc20Mint(conf.testErc20, wallet1.getAddressString(), wallet2.getAddressString(), buyerHasErc20)

		const tx = await sdk1.nft.transfer(
			{
				assetClass: "ERC1155",
				contract: toAddress(conf.testErc1155.options.address),
				tokenId: toBigNumber(nftSellerAsset.tokenId.toString()),
			},
			toAddress(wallet2.getAddressString()),
			toBigNumber(nftSellerAsset.amount.toString()),
		)
		await tx.wait()

		const order = await sdk1.order.sell({
			makeAssetType: {
				assetClass: "ERC1155",
				contract: toAddress(conf.testErc1155.options.address),
				tokenId: toBigNumber(nftSellerAsset.tokenId.toString()),
			},
			maker: toAddress(wallet1.getAddressString()),
			amount: 50,
			originFees: [],
			payouts: [],
			price: 10,
			takeAssetType: { assetClass: "ERC20", contract: toAddress(conf.testErc20.options.address) },
		})

		await verifyErc1155Balance(conf.testErc1155, wallet1.getAddressString(), nftSellerAsset.tokenId.toString(), 0)
		await awaitStockToBe(sdk1.apis.order, order.hash, 0)

	})

})
