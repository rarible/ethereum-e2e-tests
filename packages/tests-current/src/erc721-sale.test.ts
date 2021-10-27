import { createRaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { toAddress, toBigNumber } from "@rarible/types"
import { Web3Ethereum } from "@rarible/web3-ethereum"
import { RaribleV2OrderFillRequest } from "@rarible/protocol-ethereum-sdk/build/order/fill-order/types"
import { deployTestErc721, erc721Mint } from "./contracts/test-erc721"
import { deployTestErc20, erc20Mint } from "./contracts/test-erc20"
import { awaitAll } from "./common/await-all"
import { awaitStockToBe } from "./common/await-stock-to-be"
import { verifyErc20Balance } from "./common/verify-erc20-balance"
import { verifyErc721Owner } from "./common/verify-erc721-owner"
import { retry } from "./common/retry"
import { initProviders } from "./common/init-providers"

describe("erc721-sale", function () {
	const { web31, web32, wallet1, wallet2 } = initProviders({})

	const sdk1 = createRaribleSdk(new Web3Ethereum({ web3: web31 }), "e2e")
	const sdk2 = createRaribleSdk(new Web3Ethereum({ web3: web32 }), "e2e")

	const conf = awaitAll({
		testErc20: deployTestErc20(web31),
		testErc721: deployTestErc721(web31),
	})

	test("test-erc721 sell/buy using erc-20", async () => {
		await erc721Mint(conf.testErc721, wallet1.getAddressString(), wallet1.getAddressString(), 1)
		await erc20Mint(conf.testErc20, wallet1.getAddressString(), wallet2.getAddressString(), 100)

		const order = await sdk1.order.sell.start({
			makeAssetType: {
				assetClass: "ERC721",
				contract: toAddress(conf.testErc721.options.address),
				tokenId: toBigNumber("1"),
			},
			amount: 1,
			maker: toAddress(wallet1.getAddressString()),
			originFees: [],
			payouts: [],
			price: 10,
			takeAssetType: { assetClass: "ERC20", contract: toAddress(conf.testErc20.options.address) },
		}).runAll()

		await awaitStockToBe(sdk1.apis.order, order.hash, 1)
		await verifyErc20Balance(conf.testErc20, wallet2.getAddressString(), 100)

		await sdk2.order.fill.start({
			order,
			originFee: 0,
			amount: 1,
			infinite: true,
		} as RaribleV2OrderFillRequest).runAll()

		await verifyErc20Balance(conf.testErc20, wallet1.getAddressString(), 10)
		await verifyErc721Owner(conf.testErc721, 1, wallet2.getAddressString())

		await awaitStockToBe(sdk1.apis.order, order.hash, 0)

		await retry(10, async () => {
			const a = await sdk2.apis.orderActivity.getOrderActivities({
				orderActivityFilter: {
					"@type": "by_item",
					contract: toAddress(conf.testErc721.options.address),
					tokenId: toBigNumber("1"),
					types: ["MATCH", "LIST", "BID"],
				},
			})
			expect(a.items.filter(a => a["@type"] === "match")).toHaveLength(1)
			expect(a.items.filter(a => a["@type"] === "list")).toHaveLength(1)
		})
	})
})
