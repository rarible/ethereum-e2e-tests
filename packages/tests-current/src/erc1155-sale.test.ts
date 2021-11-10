import { createRaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { toAddress, toBigNumber } from "@rarible/types"
import { Web3Ethereum } from "@rarible/web3-ethereum"
import { RaribleV2OrderFillRequest } from "@rarible/protocol-ethereum-sdk/build/order/fill-order/types"
import { awaitAll } from "./common/await-all"
import { awaitStockToBe } from "./common/await-stock-to-be"
import { verifyErc20Balance } from "./common/verify-erc20-balance"
import { createErc1155EthereumContract, deployTestErc1155, erc1155Mint } from "./contracts/test-erc1155"
import { retry } from "./common/retry"
import { initProviders } from "./common/init-providers"
import { verifyErc1155Balance } from "./common/verify-erc1155-balance"
import { deployTestErc20, erc20Mint } from "./contracts/test-erc20"
import {OrderActivityFilterByItemTypes} from "@rarible/ethereum-api-client";

describe("erc1155-sale", function () {
	const { web31, web32, wallet1, wallet2 } = initProviders({})

	const ethereum1 = new Web3Ethereum({ web3: web31 })
	const sdk1 = createRaribleSdk(ethereum1, "e2e")
	const sdk2 = createRaribleSdk(new Web3Ethereum({ web3: web32 }), "e2e")

	const conf = awaitAll({
		testErc20: deployTestErc20(web31),
		testErc1155: deployTestErc1155(web31),
	})

	test("test-erc1155 sell/buy, partial buy using erc-20", async () => {
		const nftSellerHasErc1155 = { tokenId: 1, amount: 100 }
		const buyerHasErc20 = 1000
		const erc1155Contract = createErc1155EthereumContract(ethereum1, toAddress(conf.testErc1155.options.address))

		const mint1155Tx = await erc1155Mint(
			erc1155Contract,
			wallet1.getAddressString(),
			wallet1.getAddressString(),
			nftSellerHasErc1155.tokenId,
			nftSellerHasErc1155.amount,
		)
		await mint1155Tx.wait()

		await erc20Mint(conf.testErc20, wallet1.getAddressString(), wallet2.getAddressString(), buyerHasErc20)

		const order = await sdk1.order.sell.start({
			makeAssetType: {
				assetClass: "ERC1155",
				contract: toAddress(conf.testErc1155.options.address),
				tokenId: toBigNumber("1"),
			},
			amount: 50,
			maker: toAddress(wallet1.getAddressString()),
			originFees: [],
			payouts: [],
			price: 10,
			takeAssetType: { assetClass: "ERC20", contract: toAddress(conf.testErc20.options.address) },
		}).runAll()

		await awaitStockToBe(sdk1.apis.order, order.hash, 50)
		await verifyErc20Balance(conf.testErc20, wallet2.getAddressString(), buyerHasErc20)

		await sdk2.order.fill.start({
			order,
			originFee: 0,
			amount: 10,
			infinite: true,
		} as RaribleV2OrderFillRequest).runAll()

		await awaitStockToBe(sdk1.apis.order, order.hash, 40)
		await verifyErc20Balance(conf.testErc20, wallet1.getAddressString(), 100)

		await retry(3, async () => {
			const activity = await sdk2.apis.orderActivity.getOrderActivities({
				orderActivityFilter: {
					"@type": "by_item",
					contract: toAddress(conf.testErc1155.options.address),
					tokenId: toBigNumber("1"),
					types: [OrderActivityFilterByItemTypes.MATCH, OrderActivityFilterByItemTypes.LIST, OrderActivityFilterByItemTypes.BID],
				},
			})
			expect(activity.items.filter(a => a["@type"] === "match")).toHaveLength(1)
			expect(activity.items.filter(a => a["@type"] === "list")).toHaveLength(1)
		})

		await sdk2.order.fill.start({
			order,
			originFee: 0,
			amount: 20,
			infinite: true,
		} as RaribleV2OrderFillRequest).runAll()
		await verifyErc20Balance(conf.testErc20, wallet2.getAddressString(), 700)
		await awaitStockToBe(sdk1.apis.order, order.hash, 20)

		await retry(3, async () => {
			const activity = await sdk2.apis.orderActivity.getOrderActivities({
				orderActivityFilter: {
					"@type": "by_item",
					contract: toAddress(conf.testErc1155.options.address),
					tokenId: toBigNumber("1"),
					types: [OrderActivityFilterByItemTypes.MATCH, OrderActivityFilterByItemTypes.LIST, OrderActivityFilterByItemTypes.BID],
				},
			})
			expect(activity.items.filter(a => a["@type"] === "match")).toHaveLength(2)
			expect(activity.items.filter(a => a["@type"] === "list")).toHaveLength(1)
		})

	})
})
