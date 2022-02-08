import { createRaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { randomWord, toAddress, toBigNumber, toBinary } from "@rarible/types"
import { Web3Ethereum } from "@rarible/web3-ethereum"
import { OrderActivityFilterByItemTypes, OrderForm, RaribleV2Order } from "@rarible/ethereum-api-client"
import { deployTestErc721, erc721Mint } from "../contracts/test-erc721"
import { deployTestErc20, erc20Mint } from "../contracts/test-erc20"
import { awaitAll } from "../common/await-all"
import { awaitStockToBe } from "../common/await-stock-to-be"
import { verifyErc20Balance } from "../common/verify-erc20-balance"
import { verifyErc721Owner } from "../common/verify-erc721-owner"
import { initProviders } from "../common/init-providers"
import { toBn } from "../common/to-bn"
import { verifyOrderActivities } from "../common/order-activities-helper"
import { LegacyOrder } from "@rarible/ethereum-api-client/build/models/Order"

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

		const orderForm: OrderForm = {
			maker: toAddress(wallet1.getAddressString()),
			make: {
				assetType: {
					assetClass: "ERC721",
					contract: toAddress(conf.testErc721.options.address),
					tokenId: toBigNumber("1"),
				},
				value: toBigNumber("1"),
			},
			take: {
				assetType: {
					assetClass: "ERC20",
					contract: toAddress(conf.testErc20.options.address),
				},
				value: toBigNumber("10"),
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

		console.log(order.hash)
		await awaitStockToBe(sdk1.apis.order, order.hash, 1)
		await verifyErc20Balance(conf.testErc20, wallet2.getAddressString(), 100)

		const buyTx = await sdk2.order.buy({
			order,
			originFee: 0,
			amount: 1,
			infinite: true,
		})
		await buyTx.wait()
		// const hashTx = buyTx.hash
		// console.log(hashTx)

		await verifyErc20Balance(conf.testErc20, wallet1.getAddressString(), 10)
		await verifyErc721Owner(conf.testErc721, 1, wallet2.getAddressString())

		await awaitStockToBe(sdk1.apis.order, order.hash, 0)

		await verifyOrderActivities(sdk1, conf.testErc721, "1", new Map([
			[OrderActivityFilterByItemTypes.MATCH, 1],
			[OrderActivityFilterByItemTypes.LIST, 1]
		]))
	})
})
