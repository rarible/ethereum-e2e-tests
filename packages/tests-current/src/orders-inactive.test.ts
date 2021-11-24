import { createRaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { toAddress, toBigNumber } from "@rarible/types"
import { Web3Ethereum } from "@rarible/web3-ethereum"
import { createErc20EthereumContract, deployTestErc20, erc20Mint } from "./contracts/test-erc20"
import { awaitAll } from "./common/await-all"
import { awaitStockToBe } from "./common/await-stock-to-be"
import { createErc1155EthereumContract, deployTestErc1155, erc1155Mint } from "./contracts/test-erc1155"
import { initProviders } from "./common/init-providers"
import { verifyErc1155Balance } from "./common/verify-erc1155-balance"
import { deployTestErc721, erc721Mint } from "./contracts/test-erc721"
import { transferErc20 } from "./common/transfer-erc20"

describe("erc1155-sale", function() {
	const { web31, wallet1, wallet2 } = initProviders({})

	const ethereum1 = new Web3Ethereum({ web3: web31 })
	const sdk1 = createRaribleSdk(ethereum1, "e2e")

	const conf = awaitAll({
		testErc20: deployTestErc20(web31),
		testErc721: deployTestErc721(web31),
		testErc1155: deployTestErc1155(web31),
	})

	test.skip("make sell order without necessary token amount (erc1155)", async () => {
		const nftSellerAsset = { tokenId: 1, amount: 100 }
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


	test.skip("make bid without necessary token amount (erc20)", async () => {
		const erc20Contract = createErc20EthereumContract(ethereum1, toAddress(conf.testErc20.options.address))

		await erc20Mint(conf.testErc20, wallet1.getAddressString(), wallet1.getAddressString(), 100)
		await erc721Mint(conf.testErc721, wallet1.getAddressString(), wallet2.getAddressString(), 1)

		const tx = await transferErc20(erc20Contract, toAddress(wallet2.getAddressString()), 100)
		await tx.wait()

		const order = await sdk1.order.bid({
			makeAssetType: {
				assetClass: "ERC20",
				contract: toAddress(conf.testErc20.options.address),
			},
			takeAssetType: {
				assetClass: "ERC721",
				contract: toAddress(conf.testErc721.options.address),
				tokenId: toBigNumber("1"),
			},
			amount: 1,
			maker: toAddress(wallet1.getAddressString()),
			originFees: [],
			payouts: [],
			price: "10",
		})
		await awaitStockToBe(sdk1.apis.order, order.hash, 0)
	})
})
