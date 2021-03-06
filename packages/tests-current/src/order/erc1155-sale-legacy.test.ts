import { createRaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { randomWord, toAddress, toBigNumber, toBinary } from "@rarible/types"
import { Web3Ethereum } from "@rarible/web3-ethereum"
import { LegacyOrder, OrderActivityFilterByItemTypes, OrderForm } from "@rarible/ethereum-api-client"
import { deployTestErc20, erc20Mint } from "../contracts/test-erc20"
import { awaitAll } from "../common/await-all"
import { awaitStockToBe } from "../common/await-stock-to-be"
import { verifyErc20Balance } from "../common/verify-erc20-balance"
import { createErc1155EthereumContract, deployTestErc1155, erc1155Mint } from "../contracts/test-erc1155"
import { initProviders } from "../common/init-providers"
import { toBn } from "../common/to-bn"
import { verifyOrderActivities } from "../common/order-activities-helper"

describe("erc1155-sale", function() {
	const { web31, web32, wallet1, wallet2 } = initProviders({})

	const ethereum1 = new Web3Ethereum({ web3: web31 })
	const sdk1 = createRaribleSdk(ethereum1, "e2e")
	const sdk2 = createRaribleSdk(new Web3Ethereum({ web3: web32 }), "e2e")

	const conf = awaitAll({
		testErc20: deployTestErc20(web31),
		testErc1155: deployTestErc1155(web31),
	})

	test("test-erc1155 sell/buy, partial buy using erc-20 (legacy)", async () => {
		const nftSellerHasErc1155 = { tokenId: 1, amount: 100 }
		const erc1155Contract = createErc1155EthereumContract(ethereum1, toAddress(conf.testErc1155.options.address))

		const mint1155Tx = await erc1155Mint(
			erc1155Contract,
			wallet1.getAddressString(),
			wallet1.getAddressString(),
			nftSellerHasErc1155.tokenId,
			nftSellerHasErc1155.amount,
		)
		await mint1155Tx.wait()

		await erc20Mint(conf.testErc20, wallet1.getAddressString(), wallet2.getAddressString(), 1000)

		const buyerErc20InitBalance = toBn(await conf.testErc20.methods.balanceOf(wallet2.getAddressString()).call())
		const sellerErc20InitBalance = toBn(await conf.testErc20.methods.balanceOf(wallet1.getAddressString()).call())

		const maker = wallet1.getAddressString()
		const orderForm: OrderForm = {
			maker: toAddress(maker),
			make: {
				assetType: {
					assetClass: "ERC1155",
					contract: toAddress(conf.testErc1155.options.address),
					tokenId: toBigNumber("1"),
				},
				value: toBigNumber("50"),
			},
			take: {
				assetType: {
					assetClass: "ERC20",
					contract: toAddress(conf.testErc20.options.address),
				},
				value: toBigNumber("500"),
			},
			type: "RARIBLE_V1",
			data: {
				dataType: "LEGACY",
				fee: 0,
			},
			signature: toBinary("0x"),
			salt: toBigNumber(toBn(randomWord(), 16).toString(10)) as any,
		}

		const order = await sdk1.order.upsert({ order: orderForm, infinite: false }) as LegacyOrder

		await awaitStockToBe(sdk1.apis.order, order.hash, 50)
		await verifyErc20Balance(conf.testErc20, wallet2.getAddressString(), buyerErc20InitBalance.toString())

		await sdk2.order.buy({
			order,
			originFee: orderForm.data.fee,
			amount: 10,
			infinite: true,
		})

		await awaitStockToBe(sdk1.apis.order, order.hash, 40)
		await verifyErc20Balance(conf.testErc20, wallet1.getAddressString(), sellerErc20InitBalance.plus(100).toString())

		await verifyOrderActivities(sdk1, conf.testErc1155, "1", new Map([
			[OrderActivityFilterByItemTypes.MATCH, 1],
			[OrderActivityFilterByItemTypes.LIST, 1]
		]))

		await sdk2.order.buy({
			order,
			originFee: 0,
			amount: 20,
			infinite: true,
		})

		await verifyErc20Balance(conf.testErc20, wallet2.getAddressString(), buyerErc20InitBalance.minus(300).toString())
		await awaitStockToBe(sdk1.apis.order, order.hash, 20)

		await verifyOrderActivities(sdk1, conf.testErc1155, "1", new Map([
			[OrderActivityFilterByItemTypes.MATCH, 2],
			[OrderActivityFilterByItemTypes.LIST, 1]
		]))
	})
})
