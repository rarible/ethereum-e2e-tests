import { createRaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { toAddress, toBigNumber } from "@rarible/types"
import { Web3Ethereum } from "@rarible/web3-ethereum"
import { LegacyOrderFillRequest } from "@rarible/protocol-ethereum-sdk/build/order/fill-order"
import {OrderForm} from "@rarible/protocol-api-client"
import { randomWord } from "@rarible/types"
import { deployTestErc20, erc20Mint } from "./contracts/test-erc20"
import { awaitAll } from "./common/await-all"
import { awaitStockToBe } from "./common/await-stock-to-be"
import { verifyErc20Balance } from "./common/verify-erc20-balance"
import { deployTestErc1155, erc1155Mint } from "./contracts/test-erc1155"
import { retry } from "./common/retry"
import { initProviders } from "./common/init-providers"
import { toBn } from "./common/to-bn"

describe("erc1155-sale", function () {
	const { web31, web32, wallet1, wallet2 } = initProviders({})

	const sdk1 = createRaribleSdk(new Web3Ethereum({ web3: web31 }), "e2e")
	const sdk2 = createRaribleSdk(new Web3Ethereum({ web3: web32 }), "e2e")

	const conf = awaitAll({
		testErc20: deployTestErc20(web31),
		testErc1155: deployTestErc1155(web31),
	})

	test("test-erc1155 sell/buy, partial buy using erc-20 (legacy)", async () => {
		const nftSellerHasErc1155 = { tokenId: 1, amount: 100 }

		await erc1155Mint(
			conf.testErc1155,
			wallet1.getAddressString(),
			wallet1.getAddressString(),
			nftSellerHasErc1155.tokenId,
			nftSellerHasErc1155.amount,
		)
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
					contract: toAddress(conf.testErc20.options.address)
				},
				value: toBigNumber("500"),
			},
			type: "RARIBLE_V1",
			data: {
				dataType: "LEGACY",
				fee: 0,
			},
			salt: toBigNumber(toBn(randomWord(), 16).toString(10)) as any,
		}

		const upsertOrder = await sdk1.order.upsertOrder(orderForm, false)
		const order = await upsertOrder.build().runAll()

		await awaitStockToBe(sdk1.apis.order, order.hash, 50)
		await verifyErc20Balance(conf.testErc20, wallet2.getAddressString(), buyerErc20InitBalance.toString())

		await sdk2.order.fill({
			order,
			originFee: orderForm.data.fee,
			amount: 10,
			infinite: true
		} as LegacyOrderFillRequest).then(a => a.build().runAll())

		await awaitStockToBe(sdk1.apis.order, order.hash, 40)
		await verifyErc20Balance(conf.testErc20, wallet1.getAddressString(), sellerErc20InitBalance.plus(100).toString())

		await retry(3, async () => {
			const activity = await sdk2.apis.orderActivity.getOrderActivities({
				orderActivityFilter: {
					"@type": "by_item",
					contract: toAddress(conf.testErc1155.options.address),
					tokenId: toBigNumber('1'),
					types: ['BID', 'LIST', 'MATCH'],
				},
			})
			expect(activity.items.filter(a => a["@type"] === "match")).toHaveLength(1)
			expect(activity.items.filter(a => a["@type"] === "list")).toHaveLength(1)
		})

		await sdk2.order.fill({
			order,
			originFee: 0,
			amount: 20,
			infinite: true
		} as LegacyOrderFillRequest).then(a => a.build().runAll())

		await verifyErc20Balance(conf.testErc20, wallet2.getAddressString(), buyerErc20InitBalance.minus(300).toString())
		await awaitStockToBe(sdk1.apis.order, order.hash, 20)

		await retry(3, async () => {
			const activity = await sdk2.apis.orderActivity.getOrderActivities({
				orderActivityFilter: {
					"@type": "by_item",
					contract: toAddress(conf.testErc1155.options.address),
					tokenId: toBigNumber('1'),
					types: ['BID', 'LIST', 'MATCH'],
				},
			})
			expect(activity.items.filter(a => a["@type"] === "match")).toHaveLength(2)
			expect(activity.items.filter(a => a["@type"] === "list")).toHaveLength(1)
		})

	})
})
