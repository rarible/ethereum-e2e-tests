import { createRaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { toAddress, toBigNumber } from "@rarible/types"
import { Web3Ethereum } from "@rarible/web3-ethereum"
import { Contract } from "web3-eth-contract"
import { Asset, OrderStatus, Platform, RaribleV2Order } from "@rarible/ethereum-api-client"
import { CryptoPunksAssetType, Erc20AssetType } from "@rarible/ethereum-api-client/build/models"
import { awaitOwnershipValueToBe } from "./common/await-ownership-value-to-be"
import { awaitNoOwnership } from "./common/await-no-ownership"
import { initProviders } from "./common/init-providers"
import { verifyErc721Balance } from "./common/verify-erc721-balance"
import { verifyCryptoPunkOwner } from "./common/verify-crypto-punk-owner"
import { cryptoPunksContract } from "./contracts/crypto-punks"
import { verifyEthBalance } from "./common/verify-eth-balance"
import { toBn } from "./common/to-bn"
import { retry } from "./common/retry"
import { expectEqual } from "./common/expect-equal"
import { deployTestErc20, erc20Mint } from "./contracts/test-erc20"
import { verifyErc20Balance } from "./common/verify-erc20-balance"

describe("crypto punks test", function () {

	const { web31, web32, wallet1, wallet2 } = initProviders({
		pk1: "0x00120de4b1518cf1f16dc1b02f6b4a8ac29e870174cb1d8575f578480930250a",
		pk2: "0xa0d2baba419896add0b6e638ba4e50190f331db18e3271760b12ce87fa853dcb",
	})

	const sdk1 = createRaribleSdk(new Web3Ethereum({ web3: web31 }), "e2e")
	const wallet1Address = wallet1.getAddressString()
	const nftOwnership = sdk1.apis.nftOwnership

	const sdk2 = createRaribleSdk(new Web3Ethereum({ web3: web32 }), "e2e")
	const wallet2Address = wallet2.getAddressString()

	let cryptoPunks1: Contract
	let cryptoPunks2: Contract
	let cryptoPunksAddress: string
	const punkIndex = 9

	let erc20: Contract
	let erc20Address: string
	const initErc20Balance = 100

	const ORDER_TYPE_RARIBLE_V2 = "RARIBLE_V2"
	const ORDER_TYPE_CRYPTO_PUNK = "CRYPTO_PUNK"
	const ASSET_CLASS_CRYPTO_PUNKS = "CRYPTO_PUNKS"
	const ASSET_CLASS_ETH = "ETH"
	const ASSET_CLASS_ERC20 = "ERC20"
	const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

	async function init() {
		// checking initial addresses
		expect(wallet1Address).toBe("0xc66d094ed928f7840a6b0d373c1cd825c97e3c7c")
		expect(wallet2Address).toBe("0x04c5e1adfdb11b293398120847fa2bda166a4584")

		cryptoPunks1 = await cryptoPunksContract(web31)
		cryptoPunksAddress = cryptoPunks1.options.address

		cryptoPunks2 = await cryptoPunksContract(web32)

		erc20 = await deployTestErc20(web31)
		erc20Address = erc20.options.address

		await erc20Mint(erc20, wallet1Address, wallet2Address, initErc20Balance)
	}

	async function beforeTests() {
		await init()

		// checking initial balances
		// wallet1Address owns 10 punks
		await verifyErc721Balance(cryptoPunks1, wallet1Address, 10)
		await verifyCryptoPunkOwner(cryptoPunks1, punkIndex, wallet1Address)
		await verifyErc721Balance(cryptoPunks1, wallet2Address, 0)

		await awaitNoOwnership(nftOwnership, cryptoPunksAddress, punkIndex, wallet2Address)
		await awaitOwnershipValueToBe(nftOwnership, cryptoPunks1.options.address, punkIndex, wallet1Address, 1)

		await verifyErc20Balance(erc20, wallet2Address, initErc20Balance)

		await cryptoPunks1.methods.withdraw().send({ from: wallet1Address })
		await cryptoPunks2.methods.withdraw().send({ from: wallet2Address })
		if (await cryptoPunks2.methods.punkBids(punkIndex) === wallet2Address) {
			await cryptoPunks2.methods.withdrawBidForPunk(punkIndex).send({ from: wallet2Address })
		}
	}

	test("check state before test", async () => {
		await beforeTests()
	})

	// utility method
	// test("transfer back only", async () => {
	// 	await init()
	// 	await transferPunkBackToInitialOwner()
	// })

	// // utility method
	// test("cancel bids by api", async () => {
	// 	await beforeTests()
	// 	try {
	// 		await cancelBidsByApi()
	// 	} catch (e) {
	// 		console.log(`cancelRaribleBids failed: ${e}`)
	// 		throw new Error(`cancelRaribleBids failed: ${e}`)
	// 	}
	// })

	// // utility method
	// test("cancel broken punk bid", async () => {
	// 	await beforeTests()
	//
	// 	await cancelBrokenPunkBid()
	// })

	// utility method
	// test("transfer back using crypto market", async () => {
	// 	await init()
	// 	expectEqual(await cryptoPunks1.methods.punkIndexToAddress(punkIndex).call(), wallet2Address,
	// 		"can't transfer back. owner of punk")
	// 	await cryptoPunks2.methods.transferPunk(toAddress(wallet1Address), punkIndex)
	// 		.send({ from: wallet2Address })
	// 	expectEqual(await cryptoPunks1.methods.punkIndexToAddress(punkIndex).call(), wallet1Address,
	// 		"owner of punk after transfer")
	// })

	test("test failed transfer by not an owner", async () => {
		await beforeTests()

		try {
			await expect(async () => {
				await sdk2.nft.transfer(
					{
						contract: toAddress(cryptoPunksAddress),
						tokenId: toBigNumber(punkIndex.toString()),
					},
					toAddress(wallet1Address)
				)
			}).rejects.toThrowError("has not any ownerships of token with Id")

		} finally {
			await transferPunkBackToInitialOwner()
		}
	})

	test("test transfer", async () => {
		await beforeTests()

		try {
			await sdk1.nft.transfer(
				{
					contract: toAddress(cryptoPunksAddress),
					tokenId: toBigNumber(punkIndex.toString()),
				},
				toAddress(wallet2Address)
			)
			await verifyCryptoPunkOwner(cryptoPunks1, punkIndex, wallet2Address)
			await awaitNoOwnership(nftOwnership, cryptoPunksAddress, punkIndex, wallet1Address)
			await awaitOwnershipValueToBe(nftOwnership, cryptoPunks1.options.address, punkIndex, wallet2Address, 1)

		} finally {
			await transferPunkBackToInitialOwner()
		}
	}, 30000)

	test("test transfer using crypto punk market", async () => {
		await beforeTests()

		try {
			await cryptoPunks1.methods.transferPunk(toAddress(wallet2Address), punkIndex)
				.send({ from: wallet1Address })

			await verifyCryptoPunkOwner(cryptoPunks1, punkIndex, wallet2Address)
			await awaitNoOwnership(nftOwnership, cryptoPunksAddress, punkIndex, wallet1Address)
			await awaitOwnershipValueToBe(nftOwnership, cryptoPunks1.options.address, punkIndex, wallet2Address, 1)

		} finally {
			await transferPunkBackToInitialOwner()
		}
	}, 30000)

	test("test sell for eth by rarible order", async () => {
		await sellForEthByRaribleOrder(false)
	}, 30000)

	test("test sell for eth by rarible order with existing rarible bid", async () => {
		await sellForEthByRaribleOrder(true, false)
	}, 30000)

	test("test sell for eth by rarible order with existing punk bid", async () => {
		await sellForEthByRaribleOrder(false, true)
	}, 30000)

	async function sellForEthByRaribleOrder(
		withExistingRaribleBid: boolean,
		withExistingPunkBid: boolean = false
	) {
		if (withExistingRaribleBid && withExistingPunkBid) {
			throw new Error("check supports case with either rarible or punk bid")
		}

		await beforeTests()

		try {
			const balanceBefore2 = await web32.eth.getBalance(wallet2Address)

			if (withExistingRaribleBid) {
				const price = 17
				try {
					await sdk2.order.bid({
						makeAssetType: {
							assetClass: ASSET_CLASS_ERC20,
							contract: toAddress(erc20Address),
						},
						amount: 1,
						maker: toAddress(wallet2Address),
						originFees: [],
						payouts: [],
						price: price,
						takeAssetType: {
							assetClass: ASSET_CLASS_CRYPTO_PUNKS,
							contract: toAddress(cryptoPunksAddress),
							tokenId: punkIndex,
						},
					})
				} catch (e) {
					throw new Error(`order.bid failed with error: ${e}`)
				}
				await retry(3, async () => {
					const bids = await getBidsForPunkByType(ORDER_TYPE_RARIBLE_V2)
					expectEqual(bids.length, 1, "rarible bids quantity")
				})
			}

			if (withExistingPunkBid) {
				const bidPrice = 5
				await cryptoPunks2.methods.enterBidForPunk(punkIndex).send({ from: wallet2Address, value: bidPrice })
				await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(bidPrice).toString())
			}

			const price = 7
			let createdOrder: RaribleV2Order
			try {
				createdOrder = await sdk1.order.sell({
					makeAssetType: {
						assetClass: ASSET_CLASS_CRYPTO_PUNKS,
						contract: toAddress(cryptoPunksAddress),
						tokenId: punkIndex,
					},
					amount: 1,
					maker: toAddress(wallet1Address),
					originFees: [],
					payouts: [],
					price: price,
					takeAssetType: { assetClass: ASSET_CLASS_ETH },
				}) as RaribleV2Order
			} catch (e) {
				throw new Error(`order.sell failed with error: ${e}`)
			}

			console.log(`createdOrder: ${JSON.stringify(createdOrder)}`)
			checkSellOrderWithEth(createdOrder, price)

			let order = await retry(3, async () => {
				const orders = await getOrdersForPunkByType(ORDER_TYPE_RARIBLE_V2)
				expectEqual(orders.length, 1, "rarible orders quantity")
				return orders[0]
			})
			expectEqual(order.maker, createdOrder.maker, "order.maker")
			expectEqual(order.make.assetType.assetClass, createdOrder.make.assetType.assetClass, "order.make.assetType")
			expectEqual(order.make.valueDecimal, createdOrder.make.valueDecimal, "order.make.valueDecimal")
			expectEqual(order.take.assetType.assetClass, createdOrder.take.assetType.assetClass, "order.take.assetType")
			expectEqual(order.take.valueDecimal, createdOrder.take.valueDecimal, "order.take.valueDecimal")

			const balanceBefore1 = await web31.eth.getBalance(wallet1Address)

			try {
				await sdk2.order.fill({
					order,
					amount: 1,
				})
			} catch (e) {
				console.log(`order.fill failed with error: ${e}`)
				throw new Error(`order.fill failed with error: ${e}`)
			}

			await retry(3, async () => {
				const orders = await getOrdersForPunkByType(ORDER_TYPE_RARIBLE_V2)
				expectEqual(orders.length, 0, "rarible orders quantity after sale")
			})

			if (withExistingRaribleBid) {
				// there is an active bid of wallet2 - of current owner of punk. it's ok
				await retry(3, async () => {
					const bids = await getBidsForPunkByType(ORDER_TYPE_RARIBLE_V2)
					expectEqual(bids.length, 1, "rarible bids quantity after buying")
				})
			}

			if (withExistingPunkBid) {
				// bid is deleted (it was deleted by punk market)
				await cryptoPunks2.methods.withdraw().send({ from: wallet2Address })
				await retry(3, async () => {
					const cryptoPunkBids = await getBidsForPunkByType(ORDER_TYPE_CRYPTO_PUNK)
					expectEqual(cryptoPunkBids.length, 0, "punk bids after buying")
				})

				await retry(3, async () => {
					const cryptoPunkBids = await getInactiveBidsForPunkByType(ORDER_TYPE_CRYPTO_PUNK)
					expectEqual(cryptoPunkBids.length, 0, "inactive punk bids after buying")
				})
			}

			await verifyEthBalance(web31, toAddress(wallet1Address), toBn(balanceBefore1).plus(price).toString())
			await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(price).toString())

			await verifyCryptoPunkOwner(cryptoPunks1, punkIndex, wallet2Address)
			await awaitNoOwnership(nftOwnership, cryptoPunksAddress, punkIndex, wallet1Address)
			await awaitOwnershipValueToBe(nftOwnership, cryptoPunks1.options.address, punkIndex, wallet2Address, 1)

		} finally {
			await transferPunkBackToInitialOwner()
			await cancelBidsByApi()
			await cancelOrdersByApi()
		}
	}

	test("test sell for erc20 by rarible order", async () => {
		await beforeTests()

		try {
			const price = 24

			let createdOrder: RaribleV2Order
			try {
				createdOrder = await sdk1.order.sell({
					makeAssetType: {
						assetClass: ASSET_CLASS_CRYPTO_PUNKS,
						contract: toAddress(cryptoPunksAddress),
						tokenId: punkIndex,
					},
					amount: 1,
					maker: toAddress(wallet1Address),
					originFees: [],
					payouts: [],
					price: price,
					takeAssetType: {
						assetClass: ASSET_CLASS_ERC20,
						contract: toAddress(erc20Address),
					},
				}) as RaribleV2Order
			} catch (e) {
				throw new Error(`order.sell failed with error: ${e}`)
			}

			console.log(`createdOrder: ${JSON.stringify(createdOrder)}`)

			expectEqual(createdOrder.make.assetType.assetClass, ASSET_CLASS_CRYPTO_PUNKS, "type of order.make.asset")
			expectEqual(createdOrder.make.value, "1", "order.make.value")
			expectEqual(createdOrder.makeStock, "1", "order.makeStock")
			expectEqual(createdOrder.maker, wallet1Address, "order.maker")

			expectEqual(createdOrder.taker, undefined, "order.taker")
			expectEqual(createdOrder.take.assetType.assetClass, ASSET_CLASS_ERC20, "type of order.take.asset")
			expectEqual((createdOrder.take.assetType as Erc20AssetType).contract.toLowerCase(), erc20Address.toLowerCase(), "contract of order.take.asset")

			let order = await retry(3, async () => {
				const orders = await getOrdersForPunkByType(ORDER_TYPE_RARIBLE_V2)
				expectEqual(orders.length, 1, "rarible orders quantity")
				return orders[0]
			})
			expectEqual(order.maker, createdOrder.maker, "order.maker")
			expectEqual(order.make.assetType.assetClass, createdOrder.make.assetType.assetClass, "order.make.assetType")
			expectEqual(order.make.valueDecimal, createdOrder.make.valueDecimal, "order.make.valueDecimal")
			expectEqual(order.take.assetType.assetClass, createdOrder.take.assetType.assetClass, "order.take.assetType")

			try {
				await sdk2.order.fill({
					order,
					amount: 1,
				})
			} catch (e) {
				console.log("order.fill failed with error: " + e)
				throw new Error(`order.fill failed with error: ${e}`)
			}

			await verifyErc20Balance(erc20, wallet1Address, price)
			await verifyErc20Balance(erc20, wallet2Address, initErc20Balance - price)

			await verifyCryptoPunkOwner(cryptoPunks1, punkIndex, wallet2Address)
			await awaitNoOwnership(nftOwnership, cryptoPunksAddress, punkIndex, wallet1Address)
			await awaitOwnershipValueToBe(nftOwnership, cryptoPunks1.options.address, punkIndex, wallet2Address, 1)

		} finally {
			await transferPunkBackToInitialOwner()
			await cancelOrdersByApi()
		}
	}, 30000)

	test("test sell by punk order", async () => {
		await sellByPunkOrder()
	}, 30000)

	async function sellByPunkOrder() {
		await beforeTests()

		try {
			const minPrice = 8
			await cryptoPunks1.methods.offerPunkForSale(punkIndex, minPrice).send({ from: wallet1Address })
			const forSale = await cryptoPunks1.methods.punksOfferedForSale(punkIndex).call()
			expectEqual(forSale.isForSale, true, "cryptoPunk offer.isForSale")
			expectEqual(forSale.seller.toLowerCase(), wallet1Address, "cryptoPunk offer.seller")
			expectEqual(forSale.minValue, minPrice.toString(), "cryptoPunk offer.minValue")
			expectEqual(forSale.punkIndex, punkIndex.toString(), "cryptoPunk offer.punkIndex")

			let order = await retry(3, async () => {
				const orders = await getOrdersForPunkByType(ORDER_TYPE_CRYPTO_PUNK)
				expectEqual(orders.length, 1, "punk order before sale")
				return orders[0]
			})

			console.log(`order: ${JSON.stringify(order)}`)
			checkSellOrderWithEth(order, minPrice)

			const balanceBefore = await web32.eth.getBalance(wallet2Address)

			try {
				await sdk2.order.fill({
					order,
					amount: 1,
					infinite: true,
				})
			} catch (e) {
				throw new Error(`fill order failed with error: ${e}`)
			}

			await retry(3, async () => {
				const orders = await getOrdersForPunkByType(ORDER_TYPE_CRYPTO_PUNK)
				expectEqual(orders.length, 0, "punk order after sale")
			})

			await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore).minus(minPrice).toString())

			await verifyCryptoPunkOwner(cryptoPunks1, punkIndex, wallet2Address)
			await awaitNoOwnership(nftOwnership, cryptoPunksAddress, punkIndex, wallet1Address)
			await awaitOwnershipValueToBe(nftOwnership, cryptoPunks1.options.address, punkIndex, wallet2Address, 1)

		} finally {
			await transferPunkBackToInitialOwner()
		}
	}

	test("test sell to address by punk order", async () => {
		await beforeTests()

		try {
			const minPrice = 7
			await cryptoPunks1.methods.offerPunkForSaleToAddress(punkIndex, minPrice, wallet2Address)
				.send({ from: wallet1Address })
			const forSale = await cryptoPunks1.methods.punksOfferedForSale(punkIndex).call()
			console.log(`forSale: ${JSON.stringify(forSale)}`)
			expectEqual(forSale.isForSale, true, "cryptoPunk offer.isForSale")
			expectEqual(forSale.seller.toLowerCase(), wallet1Address, "cryptoPunk offer.seller")
			expectEqual(forSale.onlySellTo.toLowerCase(), wallet2Address, "cryptoPunk offer.onlySellTo")

			const order = await retry(3, async () => {
				const orders = await getOrdersForPunkByType(ORDER_TYPE_CRYPTO_PUNK)
				expectEqual(orders.length, 1, "punk orders quantity")
				return orders[0]
			})

			console.log(`order: ${JSON.stringify(order)}`)
			checkSellOrderWithEth(order, minPrice, wallet2Address)

			const balanceBefore = await web32.eth.getBalance(wallet2Address)

			try {
				await sdk2.order.fill({
					order,
					amount: 1,
					infinite: true,
				})
			} catch (e) {
				throw new Error(`fill order failed with error: ${e}`)
			}

			await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore).minus(minPrice).toString())

			await verifyCryptoPunkOwner(cryptoPunks1, punkIndex, wallet2Address)
			await awaitNoOwnership(nftOwnership, cryptoPunksAddress, punkIndex, wallet1Address)
			await awaitOwnershipValueToBe(nftOwnership, cryptoPunks1.options.address, punkIndex, wallet2Address, 1)

		} finally {
			await transferPunkBackToInitialOwner()
		}
	}, 30000)

	test("test create punk order with existing rarible order", async () => {
		await beforeTests()

		try {
			// create rarible order
			const price = 7

			let createdOrder: RaribleV2Order
			try {
				createdOrder = await sdk1.order.sell({
					makeAssetType: {
						assetClass: ASSET_CLASS_CRYPTO_PUNKS,
						contract: toAddress(cryptoPunksAddress),
						tokenId: punkIndex,
					},
					amount: 1,
					maker: toAddress(wallet1Address),
					originFees: [],
					payouts: [],
					price: price,
					takeAssetType: { assetClass: ASSET_CLASS_ETH },
				}) as RaribleV2Order
			} catch (e) {
				throw new Error(`order.sell failed with error: ${e}`)
			}

			console.log(`createdOrder: ${JSON.stringify(createdOrder)}`)
			checkSellOrderWithEth(createdOrder, price)

			let order = await retry(3, async () => {
				const orders = await getOrdersForPunkByType(ORDER_TYPE_RARIBLE_V2)
				expectEqual(orders.length, 1, "rarible orders quantity")
				return orders[0]
			})
			expectEqual(order.maker, createdOrder.maker, "order.maker")
			expectEqual(order.take.valueDecimal, createdOrder.take.valueDecimal, "order.take.valueDecimal")

			// create punk order
			const minPrice = 8
			await cryptoPunks1.methods.offerPunkForSale(punkIndex, minPrice).send({ from: wallet1Address })
			const forSale = await cryptoPunks1.methods.punksOfferedForSale(punkIndex).call()
			expectEqual(forSale.isForSale, true, "cryptoPunk offer.isForSale")
			expectEqual(forSale.seller.toLowerCase(), wallet1Address, "cryptoPunk offer.seller")
			expectEqual(forSale.minValue, minPrice.toString(), "cryptoPunk offer.minValue")
			expectEqual(forSale.onlySellTo, ZERO_ADDRESS, "cryptoPunk offer.onlySellTo")

			// expected: 1 punk order, no one rarible order
			let punkOrder = await retry(3, async () => {
				const orders = await getOrdersForPunkByType(ORDER_TYPE_CRYPTO_PUNK)
				expectEqual(orders.length, 1, "punk orders quantity")
				return orders[0]
			})

			console.log(`punk order: ${JSON.stringify(punkOrder)}`)
			checkSellOrderWithEth(punkOrder, minPrice)

			// todo error
			// rarible order must be deleted, because there is no Offer(price: 0, onlySellTo: proxy) anymore
			// whereas rarible order needs such offer for executing
			await retry(3, async () => {
				const orders = await getOrdersForPunkByType(ORDER_TYPE_RARIBLE_V2)
				expectEqual(orders.length, 0, "rarible orders quantity after creating punk order")
			})

			// // рарибл ордер должен был быть удален
			// // это подтверждение, что он нерабочий.
			// // (так как для его выполнения должен быть ордер в панко-контракте с onlySellTo=proxy и др. полями,
			// // а мы этот ордер перетерли нативным панко-ордером)
			// const raribleOrder = await retry(3, async () => {
			// 	const orders = await getOrdersForPunkByType(ORDER_TYPE_RARIBLE_V2)
			// 	expect(orders.length).toBeGreaterThan(0)
			// 	return orders[0]
			// })
			// try {
			// 	await sdk2.order.fill({
			// 		order: raribleOrder,
			// 		amount: 1,
			// 	})
			// } catch (e) {
			// 	console.log(`order.fill failed with error: ${e}`)
			// 	throw new Error(`order.fill failed with error: ${e}`)
			// }
			// await verifyCryptoPunkOwner(cryptoPunks1, punkIndex, wallet2Address)

		} finally {
			await cancelOrdersByApi()
		}
	}, 30000)

	test("test create rarible order with existing punk order", async () => {
		await beforeTests()

		try {
			// create punk order
			const minPrice = 8
			await cryptoPunks1.methods.offerPunkForSale(punkIndex, minPrice).send({ from: wallet1Address })
			const forSale = await cryptoPunks1.methods.punksOfferedForSale(punkIndex).call()
			expectEqual(forSale.isForSale, true, "cryptoPunk offer.isForSale")
			expectEqual(forSale.seller.toLowerCase(), wallet1Address, "cryptoPunk offer.seller")
			expectEqual(forSale.minValue, minPrice.toString(), "cryptoPunk offer.minValue")
			expectEqual(forSale.onlySellTo, ZERO_ADDRESS, "cryptoPunk offer.onlySellTo")

			let punkOrder = await retry(3, async () => {
				const orders = await getOrdersForPunkByType(ORDER_TYPE_CRYPTO_PUNK)
				expectEqual(orders.length, 1, "punk orders quantity")
				return orders[0]
			})

			console.log(`punk order: ${JSON.stringify(punkOrder)}`)
			checkSellOrderWithEth(punkOrder, minPrice)

			// create rarible order
			const price = 7

			let createdOrder: RaribleV2Order
			try {
				createdOrder = await sdk1.order.sell({
					makeAssetType: {
						assetClass: ASSET_CLASS_CRYPTO_PUNKS,
						contract: toAddress(cryptoPunksAddress),
						tokenId: punkIndex,
					},
					amount: 1,
					maker: toAddress(wallet1Address),
					originFees: [],
					payouts: [],
					price: price,
					takeAssetType: { assetClass: ASSET_CLASS_ETH },
				}) as RaribleV2Order
			} catch (e) {
				throw new Error(`order.sell failed with error: ${e}`)
			}

			console.log(`createdOrder: ${JSON.stringify(createdOrder)}`)
			checkSellOrderWithEth(createdOrder, price)

			// expected: 1 rarible order, no one punk order
			let order = await retry(3, async () => {
				const orders = await getOrdersForPunkByType(ORDER_TYPE_RARIBLE_V2)
				expectEqual(orders.length, 1, "rarible orders quantity")
				return orders[0]
			})
			expectEqual(order.maker, createdOrder.maker, "order.maker")
			expectEqual(order.take.valueDecimal, createdOrder.take.valueDecimal, "order.take.valueDecimal")

			const forSaleForProxy = await cryptoPunks1.methods.punksOfferedForSale(punkIndex).call()
			expectEqual(forSaleForProxy.minValue, "0", "for proxy offer.minValue")
			expectEqual(forSaleForProxy.onlySellTo !== ZERO_ADDRESS, true, "for proxy only sell to must be filled")

			// todo error
			// punk order must be deleted, because there is Offer(price: 0, onlySellTo: proxy) for proxy
			// thus punk order isn't executable anymore
			await retry(3, async () => {
				const orders = await getOrdersForPunkByType(ORDER_TYPE_CRYPTO_PUNK)
				expectEqual(orders.length, 0, "punk orders quantity after rarible order is created")
			})

			// // punk должен был быть удален
			// // это подтверждение, что он нерабочий
			// const cryptoPunkOrder = await retry(3, async () => {
			// 	const orders = await getOrdersForPunkByType(ORDER_TYPE_CRYPTO_PUNK)
			// 	expect(orders.length).toBeGreaterThan(0)
			// 	return orders[0]
			// })
			// try {
			// 	await sdk2.order.fill({
			// 		order: cryptoPunkOrder,
			// 		amount: 1,
			// 	})
			// } catch (e) {
			// 	console.log(`order.fill failed with error: ${e}`)
			// 	throw new Error(`order.fill failed with error: ${e}`)
			// }
			// await verifyCryptoPunkOwner(cryptoPunks1, punkIndex, wallet2Address)

		} finally {
			await cancelOrdersByApi()
		}
	}, 30000)

	test("test cancel rarible order", async () => {
		await beforeTests()

		const price = 24
		try {
			await sdk1.order.sell({
				makeAssetType: {
					assetClass: ASSET_CLASS_CRYPTO_PUNKS,
					contract: toAddress(cryptoPunksAddress),
					tokenId: punkIndex,
				},
				amount: 1,
				maker: toAddress(wallet1Address),
				originFees: [],
				payouts: [],
				price: price,
				takeAssetType: {
					assetClass: ASSET_CLASS_ERC20,
					contract: toAddress(erc20Address),
				},
			})
		} catch (e) {
			throw new Error(`order.sell failed with error: ${e}`)
		}

		let order = await retry(3, async () => {
			const orders = await getOrdersForPunkByType(ORDER_TYPE_RARIBLE_V2)
			expectEqual(orders.length, 1, "orders quantity from api before cancel")
			return orders[0]
		})

		await sdk1.order.cancel(order)

		await retry(3, async () => {
			const orders = await getOrdersForPunkByType(ORDER_TYPE_RARIBLE_V2)
			expectEqual(orders.length, 0, "orders quantity from api after cancel")
		})
	}, 30000)

	test("test cancel sell by punk market", async () => {
		try {
			await beforeTests()

			const minPrice = 8
			await cryptoPunks1.methods.offerPunkForSale(punkIndex, minPrice).send({ from: wallet1Address })
			const forSaleTrue = await cryptoPunks1.methods.punksOfferedForSale(punkIndex).call()
			console.log(`forSale: ${JSON.stringify(forSaleTrue)}`)
			expectEqual(forSaleTrue.isForSale, true, "cryptoPunk offer.isForSale")

			await retry(3, async () => {
				const orders = await getOrdersForPunkByType(ORDER_TYPE_CRYPTO_PUNK)
				expectEqual(orders.length, 1, "punk orders quantity")
			})

			await cryptoPunks1.methods.punkNoLongerForSale(punkIndex).send({ from: wallet1Address })

			const forSale = await cryptoPunks1.methods.punksOfferedForSale(punkIndex).call()
			console.log(`cancelled forSale: ${JSON.stringify(forSale)}`)
			expectEqual(forSale.isForSale, false, "cryptoPunk cancelled offer.isForSale")

			await retry(3, async () => {
				const orders = await getOrdersForPunkByType(ORDER_TYPE_CRYPTO_PUNK)
				expectEqual(orders.length, 0, "punk orders quantity from api")
			})

		} finally {
			await cancelOrdersByApi()
		}
	}, 30000)

	test("test cancel sell by punk market using api", async () => {
		try {
			await beforeTests()

			const minPrice = 8
			await cryptoPunks1.methods.offerPunkForSale(punkIndex, minPrice).send({ from: wallet1Address })
			const forSaleTrue = await cryptoPunks1.methods.punksOfferedForSale(punkIndex).call()
			console.log(`forSale: ${JSON.stringify(forSaleTrue)}`)
			expectEqual(forSaleTrue.isForSale, true, "cryptoPunk offer.isForSale")

			const order = await retry(3, async () => {
				const orders = await getOrdersForPunkByType(ORDER_TYPE_CRYPTO_PUNK)
				expectEqual(orders.length, 1, "punk orders quantity")
				return orders[0]
			})

			try {
				await sdk1.order.cancel(order)
			} catch (e) {
				console.log(`order.cancel failed with error: ${e}`)
				throw new Error(`order.cancel failed with error: ${e}`)
			}

			const forSale = await cryptoPunks1.methods.punksOfferedForSale(punkIndex).call()
			console.log(`cancelled forSale: ${JSON.stringify(forSale)}`)
			expectEqual(forSale.isForSale, false, "cryptoPunk cancelled offer.isForSale")

			await retry(3, async () => {
				const orders = await getOrdersForPunkByType(ORDER_TYPE_CRYPTO_PUNK)
				expectEqual(orders.length, 0, "punk orders quantity from api")
			})

		} finally {
			await cancelOrdersByApi()
		}
	}, 30000)

	test("test update sell by punk market using api", async () => {
		try {
			await beforeTests()

			const minPrice = 8
			await cryptoPunks1.methods.offerPunkForSale(punkIndex, minPrice).send({ from: wallet1Address })
			const forSale = await cryptoPunks1.methods.punksOfferedForSale(punkIndex).call()
			console.log(`forSale: ${JSON.stringify(forSale)}`)
			expectEqual(forSale.isForSale, true, "cryptoPunk offer.isForSale")
			expectEqual(forSale.minValue, minPrice.toString(), "cryptoPunk offer.minValue")

			const order = await retry(3, async () => {
				const orders = await getOrdersForPunkByType(ORDER_TYPE_CRYPTO_PUNK)
				expectEqual(orders.length, 1, "punk orders quantity")
				return orders[0]
			})

			const newMinPrice = 10
			try {
				await sdk1.order.sellUpdate({
					order,
					price: newMinPrice,
				})
			} catch (e) {
				console.log(`order.sellUpdate failed with error: ${e}`)
				throw new Error(`order.sellUpdate failed with error: ${e}`)
			}

			const forSaleUpdated = await cryptoPunks1.methods.punksOfferedForSale(punkIndex).call()
			console.log(`updated forSale: ${JSON.stringify(forSaleUpdated)}`)
			expectEqual(forSaleUpdated.isForSale, true, "cryptoPunk updated offer.isForSale")
			expectEqual(forSaleUpdated.minValue, newMinPrice.toString(), "cryptoPunk updated offer.minValue")

			await retry(3, async () => {
				const orders = await getOrdersForPunkByType(ORDER_TYPE_CRYPTO_PUNK)
				expectEqual(orders.length, 1, "punk orders quantity")
				const order = orders[0]
				expectEqual(order.take.value, newMinPrice.toString(), "updated sell order: take.value")
			})

		} finally {
			await cancelOrdersByApi()
		}
	}, 30000)

	test("test cancel bid by punk market", async () => {
		try {
			await beforeTests()

			const price = 8

			const balanceBefore2 = await web32.eth.getBalance(wallet2Address)

			await cryptoPunks2.methods.enterBidForPunk(punkIndex).send({ from: wallet2Address, value: price })
			const cryptoPunkBid = await cryptoPunks2.methods.punkBids(punkIndex).call()
			expectEqual(cryptoPunkBid.hasBid, true, "cryptoPunkBid.hasBid")
			await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(price).toString())

			await retry(3, async () => {
				const bids = await getBidsForPunkByType(ORDER_TYPE_CRYPTO_PUNK)
				expectEqual(bids.length, 1, "punk bids quantity")
			})

			await cryptoPunks2.methods.withdrawBidForPunk(punkIndex).send({ from: wallet2Address })

			await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).toString())

			const cryptoPunkCancelledBid = await cryptoPunks2.methods.punkBids(punkIndex).call()
			expectEqual(cryptoPunkCancelledBid.hasBid, false, "cancelled bid.hasBid")

			await retry(3, async () => {
				const bids = await getBidsForPunkByType(ORDER_TYPE_CRYPTO_PUNK)
				expectEqual(bids.length, 0, "punk bids quantity from api")
			})

		} finally {
			await cancelBidsByApi()
		}
	}, 30000)

	test("test cancel bid by punk market using api", async () => {
		try {
			await beforeTests()

			const price = 8

			const balanceBefore2 = await web32.eth.getBalance(wallet2Address)

			await cryptoPunks2.methods.enterBidForPunk(punkIndex).send({ from: wallet2Address, value: price })
			const cryptoPunkBid = await cryptoPunks2.methods.punkBids(punkIndex).call()
			expectEqual(cryptoPunkBid.hasBid, true, "cryptoPunkBid.hasBid")
			await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(price).toString())

			const bid = await retry(3, async () => {
				const bids = await getBidsForPunkByType(ORDER_TYPE_CRYPTO_PUNK)
				expectEqual(bids.length, 1, "punk bids quantity")
				return bids[0]
			})

			try {
				await sdk2.order.cancel(bid)
			} catch (e) {
				console.log(`order.cancel failed with error: ${e}`)
				throw new Error(`order.cancel failed with error: ${e}`)
			}

			const cryptoPunkCancelledBid = await cryptoPunks2.methods.punkBids(punkIndex).call()
			expectEqual(cryptoPunkCancelledBid.hasBid, false, "cancelled bid.hasBid")

			await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).toString())

			await retry(3, async () => {
				const cryptoPunkBids = await getBidsForPunkByType(ORDER_TYPE_CRYPTO_PUNK)
				expectEqual(cryptoPunkBids.length, 0, "punk bids quantity from api")
			})

		} finally {
			await cancelBidsByApi()
		}
	}, 30000)

	test("test update bid by punk market", async () => {
		try {
			await beforeTests()

			const price = 8

			const balanceBefore2 = await web32.eth.getBalance(wallet2Address)

			await cryptoPunks2.methods.enterBidForPunk(punkIndex).send({ from: wallet2Address, value: price })
			const cryptoPunkBid = await cryptoPunks2.methods.punkBids(punkIndex).call()
			expectEqual(cryptoPunkBid.hasBid, true, "cryptoPunkBid.hasBid")
			expectEqual(cryptoPunkBid.value, price.toString(), "cryptoPunkBid.value")
			await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(price).toString())

			await retry(3, async () => {
				const bids = await getBidsForPunkByType(ORDER_TYPE_CRYPTO_PUNK)
				expectEqual(bids.length, 1, "punk bids quantity")
				const bid = bids[0]
				expectEqual(bid.make.value, price.toString(), "updated bid: make.value")
			})

			const newPrice = 10//todo check на понижение

			await cryptoPunks2.methods.enterBidForPunk(punkIndex).send({ from: wallet2Address, value: newPrice })

			const cryptoPunkBidUpdated = await cryptoPunks2.methods.punkBids(punkIndex).call()
			expectEqual(cryptoPunkBidUpdated.hasBid, true, "cryptoPunkBid updated .hasBid")
			expectEqual(cryptoPunkBidUpdated.value, newPrice.toString(), "cryptoPunkBid updated .value")

			await cryptoPunks2.methods.withdraw().send({ from: wallet2Address })
			await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(newPrice).toString())

			await retry(3, async () => {
				const bids = await getBidsForPunkByType(ORDER_TYPE_CRYPTO_PUNK)
				expectEqual(bids.length, 1, "punk bids quantity after update")
				const bid = bids[0]
				expectEqual(bid.make.value, newPrice.toString(), "updated bid: make.value")
			})

		} finally {
			await cancelBidsByApi()
		}
	}, 30000)

	test("test update bid by punk market using api", async () => {
		try {
			await beforeTests()

			const price = 8

			const balanceBefore2 = await web32.eth.getBalance(wallet2Address)

			await cryptoPunks2.methods.enterBidForPunk(punkIndex).send({ from: wallet2Address, value: price })
			const cryptoPunkBid = await cryptoPunks2.methods.punkBids(punkIndex).call()
			expectEqual(cryptoPunkBid.hasBid, true, "cryptoPunkBid.hasBid")
			expectEqual(cryptoPunkBid.value, price.toString(), "cryptoPunkBid.value")
			await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(price).toString())

			const bid = await retry(3, async () => {
				const bids = await getBidsForPunkByType(ORDER_TYPE_CRYPTO_PUNK)
				expectEqual(bids.length, 1, "punk bids quantity")
				return bids[0]
			})

			const newPrice = 10//todo check на понижение
			try {
				await sdk2.order.bidUpdate({
					order: bid,
					price: newPrice,
				})
			} catch (e) {
				console.log(`order.bidUpdate failed with error: ${e}`)
				throw new Error(`order.bidUpdate failed with error: ${e}`)
			}

			const cryptoPunkBidUpdated = await cryptoPunks2.methods.punkBids(punkIndex).call()
			expectEqual(cryptoPunkBidUpdated.hasBid, true, "cryptoPunkBid updated .hasBid")
			expectEqual(cryptoPunkBidUpdated.value, newPrice.toString(), "cryptoPunkBid updated .value")

			await cryptoPunks2.methods.withdraw().send({ from: wallet2Address })
			await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(newPrice).toString())

			await retry(3, async () => {
				const bids = await getBidsForPunkByType(ORDER_TYPE_CRYPTO_PUNK)
				expectEqual(bids.length, 1, "punk bids quantity")
				const bid = bids[0]
				expectEqual(bid.make.value, newPrice.toString(), "updated bid: make.value")
			})

		} finally {
			await cancelBidsByApi()
		}
	}, 30000)

	test("test bid by punk market and transfer", async () => {
		try {
			await beforeTests()

			const price = 8

			const balanceBefore2 = await web32.eth.getBalance(wallet2Address)

			await cryptoPunks2.methods.enterBidForPunk(punkIndex).send({ from: wallet2Address, value: price })
			const cryptoPunkBid = await cryptoPunks2.methods.punkBids(punkIndex).call()
			expectEqual(cryptoPunkBid.hasBid, true, "cryptoPunkBid.hasBid")
			await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(price).toString())

			await retry(3, async () => {
				const bids = await getBidsForPunkByType(ORDER_TYPE_CRYPTO_PUNK)
				expectEqual(bids.length, 1, "punk bids quantity")
			})

			await sdk1.nft.transfer(
				{
					contract: toAddress(cryptoPunksAddress),
					tokenId: toBigNumber(punkIndex.toString()),
				},
				toAddress(wallet2Address)
			)

			const cryptoPunkCancelledBid = await cryptoPunks2.methods.punkBids(punkIndex).call()
			expectEqual(cryptoPunkCancelledBid.hasBid, false, "punk bid.hasBid after transferring")

			// todo ошибка: punk бид д б удален, т к в контракте нет его соответствия.
			//  его невозможно ни реализовать ни отменить. стейт патовый
			//  чинится только созданием заново панк-бида и потом уже отменой (cancelBrokenPunkBid)
			// punk bid is deleted
			await retry(3, async () => {
				const bids = await getBidsForPunkByType(ORDER_TYPE_CRYPTO_PUNK)
				expectEqual(bids.length, 0, "punk bids quantity after transfer")
			})

		} finally {
			await transferPunkBackToInitialOwner()
			await cancelBrokenPunkBid()
		}
	}, 30000)

	test("test buy using rarible bid with erc20", async () => {
		await beforeTests()

		try {
			const price = 24

			let createdBid: RaribleV2Order
			try {
				createdBid = await sdk2.order.bid({
					makeAssetType: {
						assetClass: ASSET_CLASS_ERC20,
						contract: toAddress(erc20Address),
					},
					amount: 1,
					maker: toAddress(wallet2Address),
					originFees: [],
					payouts: [],
					price: price,
					takeAssetType: {
						assetClass: ASSET_CLASS_CRYPTO_PUNKS,
						contract: toAddress(cryptoPunksAddress),
						tokenId: punkIndex,
					},
				}) as RaribleV2Order
			} catch (e) {
				throw new Error(`order.bid failed with error: ${e}`)
			}

			console.log(`bid: ${JSON.stringify(createdBid)}`)

			expectEqual(createdBid.make.assetType.assetClass, ASSET_CLASS_ERC20, "type of bid.make.asset")
			expectEqual((createdBid.make.assetType as Erc20AssetType).contract.toLowerCase(), erc20Address.toLowerCase(), "contract of bid.make.asset")
			expectEqual(createdBid.maker, wallet2Address, "bid.maker")

			expectEqual(createdBid.taker, undefined, "bid.taker")
			expectEqual(createdBid.take.assetType.assetClass, ASSET_CLASS_CRYPTO_PUNKS, "type of bid.take.asset")
			const takeAsset = createdBid.take.assetType as CryptoPunksAssetType
			expectEqual(takeAsset.contract.toLowerCase(), cryptoPunksAddress.toLowerCase(), "contract of bid.take.asset")
			expectEqual(takeAsset.tokenId, punkIndex, "tokenId of bid.take.asset")
			expectEqual(createdBid.take.value, "1", "bid.take.value")

			let bid = await retry(3, async () => {
				const bids = await getBidsForPunkByType(ORDER_TYPE_RARIBLE_V2)
				expectEqual(bids.length, 1, "rarible bids quantity")
				return bids[0]
			})
			expectEqual(bid.maker, createdBid.maker, "bid.maker")
			expectEqual(bid.make.assetType.assetClass, createdBid.make.assetType.assetClass, "bid.make.assetType")
			expectEqual(bid.make.valueDecimal, createdBid.make.valueDecimal, "bid.make.valueDecimal")
			expectEqual(bid.take.assetType.assetClass, createdBid.take.assetType.assetClass, "bid.take.assetType")

			try {
				await sdk1.order.fill({
					order: bid,
					amount: price,
				})
			} catch (e) {
				console.log("order.fill failed with error: " + e)
				throw new Error(`order.fill failed with error: ${e}`)
			}

			await verifyErc20Balance(erc20, wallet1Address, price)
			await verifyErc20Balance(erc20, wallet2Address, initErc20Balance - price)

			await verifyCryptoPunkOwner(cryptoPunks1, punkIndex, wallet2Address)
			await awaitNoOwnership(nftOwnership, cryptoPunksAddress, punkIndex, wallet1Address)
			await awaitOwnershipValueToBe(nftOwnership, cryptoPunks1.options.address, punkIndex, wallet2Address, 1)

		} finally {
			await transferPunkBackToInitialOwner()
			await cancelBidsByApi()
		}
	}, 30000)

	test("test buy using bid by punk market", async () => {
		await buyUsingBidByCryptoPunkMarket(false)
	}, 30000)

	test("test buy using bid by punk market with existing rarible order", async () => {
		await buyUsingBidByCryptoPunkMarket(true)
	}, 30000)

	test("test buy using bid by punk market with existing punk order", async () => {
		await buyUsingBidByCryptoPunkMarket(false, true)
	}, 30000)

	async function buyUsingBidByCryptoPunkMarket(
		withExistingRaribleOrder: boolean,
		withExistingPunkOrder: boolean = false
	) {
		if (withExistingRaribleOrder && withExistingPunkOrder) {
			throw new Error("check supports case with either rarible or punk order")
		}

		await beforeTests()

		try {
			if (withExistingRaribleOrder) {
				const price = 10
				try {
					await sdk1.order.sell({
						makeAssetType: {
							assetClass: ASSET_CLASS_CRYPTO_PUNKS,
							contract: toAddress(cryptoPunksAddress),
							tokenId: punkIndex,
						},
						amount: 1,
						maker: toAddress(wallet1Address),
						originFees: [],
						payouts: [],
						price: price,
						takeAssetType: { assetClass: ASSET_CLASS_ETH },
					})
				} catch (e) {
					throw new Error(`order.sell failed with error: ${e}`)
				}

				await retry(3, async () => {
					const orders = await getOrdersForPunkByType(ORDER_TYPE_RARIBLE_V2)
					expectEqual(orders.length, 1, "rarible order before bid")
				})
			}

			if (withExistingPunkOrder) {
				const minPrice = 28
				await cryptoPunks1.methods.offerPunkForSale(punkIndex, minPrice).send({ from: wallet1Address })
				await retry(3, async () => {
					const orders = await getOrdersForPunkByType(ORDER_TYPE_CRYPTO_PUNK)
					expectEqual(orders.length, 1, "punk order before bid")
				})
			}

			const price = 5

			const balanceBefore2 = await web32.eth.getBalance(wallet2Address)
			await cryptoPunks2.methods.enterBidForPunk(punkIndex).send({ from: wallet2Address, value: price })
			await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(price).toString())

			const cryptoPunkBid = await cryptoPunks2.methods.punkBids(punkIndex).call()
			console.log(`cryptoPunkBid: ${JSON.stringify(cryptoPunkBid)}`)
			expectEqual(cryptoPunkBid.hasBid, true, "cryptoPunkBid.hasBid")
			expectEqual(cryptoPunkBid.bidder.toLowerCase(), wallet2Address, "cryptoPunkBid.bidder")
			expectEqual(cryptoPunkBid.value, price.toString(), "cryptoPunkBid.value")
			expectEqual(cryptoPunkBid.punkIndex, punkIndex.toString(), "cryptoPunkBid.punkIndex")

			const bid = await retry(3, async () => {
				const cryptoPunkBids = await getBidsForPunkByType(ORDER_TYPE_CRYPTO_PUNK)
				expectEqual(cryptoPunkBids.length, 1, "punk bid before accepting")
				return cryptoPunkBids[0]
			})

			console.log(`bid: ${JSON.stringify(bid)}`)
			checkBidWithEth(bid, price)

			try {
				await sdk1.order.fill({
					order: bid,
					amount: 1,
					infinite: true,
				})
			} catch (e) {
				console.log(`fill order (bid) failed with error: ${e}`)
				throw new Error(`fill order (bid) failed with error: ${e}`)
			}

			await retry(3, async () => {
				const cryptoPunkBids = await getBidsForPunkByType(ORDER_TYPE_CRYPTO_PUNK)
				expectEqual(cryptoPunkBids.length, 0, "punk bids quantity after accepting")
			})

			const balanceBefore1 = await web31.eth.getBalance(wallet1Address)
			await cryptoPunks1.methods.withdraw().send({ from: wallet1Address })
			await verifyEthBalance(web31, toAddress(wallet1Address), toBn(balanceBefore1).plus(price).toString())

			await verifyCryptoPunkOwner(cryptoPunks1, punkIndex, wallet2Address)
			await awaitNoOwnership(nftOwnership, cryptoPunksAddress, punkIndex, wallet1Address)
			await awaitOwnershipValueToBe(nftOwnership, cryptoPunks1.options.address, punkIndex, wallet2Address, 1)

			if (withExistingRaribleOrder) {
				await retry(3, async () => {
					const orders = await getOrdersForPunkByType(ORDER_TYPE_RARIBLE_V2)
					expectEqual(orders.length, 0, "rarible order after accepting bid")
				})
				// todo error: при accept bid sell-ордер стал со статусом inactive. т е после возвращения панка владельцу
				// ордера он опять активный, хотя нереализуем (т к при accept bid записывается Offer(isForSale=false)
				await retry(3, async () => {
					const orders = await getInactiveOrdersForPunkByType(ORDER_TYPE_RARIBLE_V2)
					expectEqual(orders.length, 0, "inactive rarible order after accepting bid")
				})
				// transfer punk back and check that there is still no rarible order
				await transferPunkBackToInitialOwner()
				await retry(3, async () => {
					const orders = await getOrdersForPunkByType(ORDER_TYPE_RARIBLE_V2)
					expectEqual(orders.length, 0, "rarible orders quantity after accepting bid")
				})

				// // это подтверждение, что ордер нереализуем
				// const order = await retry(3, async () => {
				// 	const orders = await getOrdersForPunkByType(ORDER_TYPE_RARIBLE_V2)
				// 	expectEqual(orders.length, 1, "rarible order after accepting bid")
				// 	return orders[0]
				// })
				// try {
				// 	await sdk2.order.fill({
				// 		order: order,
				// 		amount: 1,
				// 	})
				// } catch (e) {
				// 	console.log(`order.fill failed with error: ${e}`)
				// 	throw new Error(`order.fill failed with error: ${e}`)
				// }
				// await verifyCryptoPunkOwner(cryptoPunks1, punkIndex, wallet2Address)
			}

			if (withExistingPunkOrder) {
				await retry(3, async () => {
					const orders = await getOrdersForPunkByType(ORDER_TYPE_CRYPTO_PUNK)
					expectEqual(orders.length, 0, "punk order after accepting bid")
				})
				// todo error: при accept bid sell-ордер стал со статусом inactive. т е после возвращения панка владельцу
				// ордера он опять активный, хотя нереализуем (т к при accept bid записывается Offer(isForSale=false)
				await retry(3, async () => {
					const orders = await getInactiveOrdersForPunkByType(ORDER_TYPE_CRYPTO_PUNK)
					expectEqual(orders.length, 0, "inactive punk order after accepting bid")
				})
				// transfer punk back and check that there is still no punk order
				await transferPunkBackToInitialOwner()
				// todo тут тоже ошибка. он inactive, значит при получении панка назад ордер д б active,
				//  но он все равно inactive
				await retry(3, async () => {
					const orders = await getOrdersForPunkByType(ORDER_TYPE_CRYPTO_PUNK)
					expectEqual(orders.length, 1, "punk orders quantity after transferring back")
				})
			}

		} finally {
			await transferPunkBackToInitialOwner()
			await cancelOrdersByApi()
			await cancelBidsByApi()
		}
	}

	async function transferPunkBackToInitialOwner() {
		const punkOwner = await cryptoPunks1.methods.punkIndexToAddress(punkIndex).call()
		if (punkOwner.toLowerCase() === wallet1Address) {
			console.log("no need to transfer back")
			return
		} else if (punkOwner.toLowerCase() !== wallet2Address) {
			throw Error(`Punk with id ${punkIndex} is owned by the third side user: ${punkOwner}`)
		}
		console.log("transferring back")
		await verifyCryptoPunkOwner(cryptoPunks1, punkIndex, wallet2Address)
		await awaitOwnershipValueToBe(nftOwnership, cryptoPunks1.options.address, punkIndex, wallet2Address, 1)

		await sdk2.nft.transfer(
			{
				contract: toAddress(cryptoPunksAddress),
				tokenId: toBigNumber(punkIndex.toString()),
			},
			toAddress(wallet1Address)
		)
		await verifyCryptoPunkOwner(cryptoPunks1, punkIndex, wallet1Address)
		await awaitNoOwnership(nftOwnership, cryptoPunksAddress, punkIndex, wallet2Address)
		await awaitOwnershipValueToBe(nftOwnership, cryptoPunks1.options.address, punkIndex, wallet1Address, 1)
		console.log("transferred back")
	}

	async function cancelOrdersByApi() {
		await retry(3, async () => {
			const orders = (await sdk1.apis.order.getSellOrdersByItem({
				contract: cryptoPunksAddress,
				tokenId: punkIndex.toString(),
				platform: Platform.ALL,
			})).orders

			console.log(`orders to cancel: ${orders.length}`)
			if (orders.length === 0) {
				return
			}

			await Promise.all(orders.map(async (order) => {
				await sdk1.order.cancel(order)
				console.log(`order(${order.type}) cancelled`)
			}))

			const ordersAfterCancelling = (await sdk1.apis.order.getSellOrdersByItem({
				contract: cryptoPunksAddress,
				tokenId: punkIndex.toString(),
				platform: Platform.ALL,
			})).orders
			expectEqual(ordersAfterCancelling.length, 0, "orders quantity from api after cancel")
		})
	}

	async function cancelBidsByApi() {
		await retry(3, async () => {
			const bids = (await sdk2.apis.order.getOrderBidsByItem({
				contract: cryptoPunksAddress,
				tokenId: punkIndex.toString(),
				platform: Platform.ALL,
			})).orders

			console.log(`bids to cancel: ${bids.length}`)
			if (bids.length === 0) {
				return
			}

			await Promise.all(bids.map(async (bid) => {
				await sdk2.order.cancel(bid)
				console.log(`bid(${bid.type}) cancelled`)
			}))

			const ordersAfterCancelling = (await sdk2.apis.order.getOrderBidsByItem({
				contract: cryptoPunksAddress,
				tokenId: punkIndex.toString(),
				platform: Platform.ALL,
			})).orders
			expectEqual(ordersAfterCancelling.length, 0, "bids quantity from api after cancel")
		})
	}

	async function getOrdersForPunkByType(type: String): Promise<RaribleV2Order[]> {
		const orders = (await sdk1.apis.order.getSellOrdersByItem({
			contract: cryptoPunksAddress,
			tokenId: punkIndex.toString(),
			platform: Platform.ALL,
		})).orders
		console.log(`orders[${orders.length}]: ${JSON.stringify(orders)}`)
		return orders
			.filter(a => a["type"] === type)
			.map(o => o as RaribleV2Order)
	}

	async function getInactiveOrdersForPunkByType(type: String): Promise<RaribleV2Order[]> {
		const orders = (await sdk1.apis.order.getSellOrdersByMakerAndByStatus({
			maker: wallet1Address,
			platform: Platform.ALL,
			status: [OrderStatus.INACTIVE],
		})).orders
		return orders
			.filter(a => a["type"] === type && ((a["make"]as Asset)["assetType"] as CryptoPunksAssetType)["tokenId"] === punkIndex)
			.map(o => o as RaribleV2Order)
	}

	async function getBidsForPunkByType(type: String): Promise<RaribleV2Order[]> {
		const bids = (await sdk1.apis.order.getOrderBidsByItem({
			contract: cryptoPunksAddress,
			tokenId: punkIndex.toString(),
			platform: Platform.ALL,
		})).orders
		console.log(`bids[${bids.length}]: ${JSON.stringify(bids)}`)
		return bids
			.filter(a => a["type"] === type)
			.map(o => o as RaribleV2Order)
	}

	async function getInactiveBidsForPunkByType(type: String): Promise<RaribleV2Order[]> {
		const orders = (await sdk2.apis.order.getOrderBidsByMakerAndByStatus({
			maker: wallet2Address,
			platform: Platform.ALL,
			status: [OrderStatus.INACTIVE],
		})).orders
		return orders
			.filter(a => a["type"] === type && ((a["take"]as Asset)["assetType"] as CryptoPunksAssetType)["tokenId"] === punkIndex)
			.map(o => o as RaribleV2Order)
	}

	function checkSellOrderWithEth(order: RaribleV2Order, price: number, taker: string | undefined = undefined) {
		expectEqual(order.make.assetType.assetClass, ASSET_CLASS_CRYPTO_PUNKS, "type of order.make.asset")
		expectEqual(order.make.value, "1", "order.make.value")
		expectEqual(order.makeStock, "1", "order.makeStock")
		expectEqual(order.maker, wallet1Address, "order.maker")

		expectEqual(order.taker, taker, "order.taker")
		expectEqual(order.take.assetType.assetClass, ASSET_CLASS_ETH, "type of order.take.asset")
		expectEqual(order.take.valueDecimal, Math.pow(10, -18) * price, "order.take.valueDecimal")
	}

	function checkBidWithEth(bid: RaribleV2Order, price: number, taker: string | undefined = undefined) {
		expectEqual(bid.make.assetType.assetClass, ASSET_CLASS_ETH, "type of bid.make.asset")
		expectEqual(bid.make.valueDecimal, Math.pow(10, -18) * price, "bid.make.value")
		expectEqual(bid.maker, wallet2Address, "bid.maker")

		expectEqual(bid.taker, taker, "bid.taker")
		expectEqual(bid.take.assetType.assetClass, ASSET_CLASS_CRYPTO_PUNKS, "type of bid.take.asset")
		expectEqual(bid.take.valueDecimal, 1, "bid.take.valueDecimal")
	}

	async function cancelBrokenPunkBid() {
		try {
			// это чинит патовую ситуацию: на протоколе есть punk bid, но его невозможно отменить, т к его нет в контракте
			// создаем в контракте опять и потом только отменяется
			await cryptoPunks2.methods.enterBidForPunk(punkIndex).send({ from: wallet2Address, value: 1 })
			await cancelBidsByApi()
		} catch (e) {
			console.log(`cancelBidsByApi failed: ${e}`)
			throw new Error(`cancelBidsByApi failed: ${e}`)
		}
	}

	// const orders = (await sdk1.apis.order.getOrderBidsByMakerAndByStatus({
	// 	maker: wallet2Address,
	// 	platform: Platform.ALL,
	// 	status: [OrderStatus.ACTIVE, OrderStatus.CANCELLED, OrderStatus.FILLED, //OrderStatus.HISTORICAL,
	// 		OrderStatus.INACTIVE],
	// })).orders
	// console.log(`bids with all statuses: ${JSON.stringify(orders)}`)
})
