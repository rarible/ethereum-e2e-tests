import { createRaribleSdk } from "@rarible/protocol-ethereum-sdk"
import fetch from "node-fetch"
import { toAddress, toBigNumber } from "@rarible/types"
import { Web3Ethereum } from "@rarible/web3-ethereum"
import { createE2eProvider } from "./common/create-e2e-provider"
import { deployTestErc20, erc20Mint } from "./contracts/test-erc20"
import { awaitAll } from "./common/await-all"
import { awaitStockToBe } from "./common/await-stock-to-be"
import { verifyErc20Balance } from "./common/verify-erc20-balance"
import { deployTestErc1155, erc1155Mint } from "./contracts/test-erc1155"
import { retry } from "./retry"

describe("erc1155-sale", function () {
	const { web3: web31, wallet: wallet1 } = createE2eProvider()
	const { web3: web32, wallet: wallet2 } = createE2eProvider()

	const sdk1 = createRaribleSdk(new Web3Ethereum({ web3: web31 }), "e2e", { fetchApi: fetch })
	const sdk2 = createRaribleSdk(new Web3Ethereum({ web3: web32 }), "e2e", { fetchApi: fetch })

	const conf = awaitAll({
		testErc20: deployTestErc20(web31),
		testErc1155: deployTestErc1155(web31),
	})

	test("test-erc1155 sell/buy, partial buy using erc-20", async () => {
		const nftSellerHasErc1155 = { tokenId: 1, amount: 100 }
		const buyerHasErc20 = 1000

		await erc1155Mint(
			conf.testErc1155,
			wallet1.getAddressString(),
			wallet1.getAddressString(),
			nftSellerHasErc1155.tokenId,
			nftSellerHasErc1155.amount,
		)
		await erc20Mint(conf.testErc20, wallet1.getAddressString(), wallet2.getAddressString(), buyerHasErc20)

		const order = await sdk1.order.sell({
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
		}).then(a => a.runAll())

		await awaitStockToBe(sdk1.apis.order, order.hash, 50)
		await verifyErc20Balance(conf.testErc20, wallet2.getAddressString(), buyerHasErc20)

		await sdk2.order.fill(order, { payouts: [], originFees: [], amount: 10, infinite: true }).then(a => a.runAll())

		await awaitStockToBe(sdk1.apis.order, order.hash, 40)
		await verifyErc20Balance(conf.testErc20, wallet1.getAddressString(), 100)

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

		await sdk2.order.fill(order, { payouts: [], originFees: [], amount: 20, infinite: true }).then(a => a.runAll())
		await verifyErc20Balance(conf.testErc20, wallet2.getAddressString(), 700)
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

	}, 30000)
})
