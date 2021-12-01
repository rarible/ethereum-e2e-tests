import {createRaribleSdk, RaribleSdk} from "@rarible/protocol-ethereum-sdk"
import {toAddress} from "@rarible/types"
import {Web3Ethereum} from "@rarible/web3-ethereum"
import {Contract} from "web3-eth-contract"
import {Asset, EthAssetType, OrderStatus, Platform, RaribleV2Order} from "@rarible/ethereum-api-client"
import {CryptoPunksAssetType, Erc20AssetType} from "@rarible/ethereum-api-client/build/models"
import {CryptoPunkOrder, Order} from "@rarible/ethereum-api-client/build/models/Order"
import Web3 from "web3"
import {awaitOwnershipValueToBe} from "./common/await-ownership-value-to-be"
import {awaitNoOwnership} from "./common/await-no-ownership"
import {initProvider, initProviders} from "./common/init-providers"
import {verifyErc721Balance} from "./common/verify-erc721-balance"
import {verifyCryptoPunkOwner} from "./common/verify-crypto-punk-owner"
import {cryptoPunksAddress, cryptoPunksContract} from "./contracts/crypto-punks"
import {verifyEthBalance} from "./common/verify-eth-balance"
import {toBn} from "./common/to-bn"
import {retry} from "./common/retry"
import {expectEqual, expectLength} from "./common/expect-equal"
import {deployTestErc20, erc20Mint} from "./contracts/test-erc20"
import {verifyErc20Balance} from "./common/verify-erc20-balance"

describe("crypto punks test", function () {

	const { web31, web32, wallet1, wallet2 } = initProviders({
		pk1: "0x00120de4b1518cf1f16dc1b02f6b4a8ac29e870174cb1d8575f578480930250a",
		pk2: "0xa0d2baba419896add0b6e638ba4e50190f331db18e3271760b12ce87fa853dcb",
	})
	const {web3: web33, wallet: wallet3} =
		initProvider("ded057615d97f0f1c751ea2795bc4b03bbf44844c13ab4f5e6fd976506c276b9")

	const sdk1 = createRaribleSdk(new Web3Ethereum({ web3: web31 }), "e2e")
	const wallet1Address = wallet1.getAddressString()

	const sdk2 = createRaribleSdk(new Web3Ethereum({ web3: web32 }), "e2e")
	const wallet2Address = wallet2.getAddressString()

	const wallet3Address = wallet3.getAddressString()
	const sdk3 = createRaribleSdk(new Web3Ethereum({ web3: web33 }), "e2e")

	const nftOwnershipApi = sdk1.apis.nftOwnership

	let cryptoPunks1: Contract
	let cryptoPunks2: Contract
	let cryptoPunks3: Contract
	const punkIndex = 9

	let erc20: Contract
	let erc20Address: string
	let ASSET_TYPE_ERC20: Erc20AssetType
	const initErc20Balance = 100

	const ORDER_TYPE_RARIBLE_V2 = "RARIBLE_V2"
	const ORDER_TYPE_CRYPTO_PUNK = "CRYPTO_PUNK"
	const ASSET_TYPE_ETH: EthAssetType = { "assetClass": "ETH" }
	const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

	let ASSET_TYPE_CRYPTO_PUNK: CryptoPunksAssetType

	beforeEach(async () => {
		printLog("Started test init")
		// checking initial addresses
		expect(wallet1Address).toBe("0xc66d094ed928f7840a6b0d373c1cd825c97e3c7c")
		expect(wallet2Address).toBe("0x04c5e1adfdb11b293398120847fa2bda166a4584")
		expect(wallet3Address).toBe("0xa95e8f190179d999c53dd61f1a43284e12e8fdd2")

		cryptoPunks1 = await cryptoPunksContract(web31)
		cryptoPunks2 = await cryptoPunksContract(web32)
		cryptoPunks3 = await cryptoPunksContract(web33)

		erc20 = await deployTestErc20(web31)
		erc20Address = erc20.options.address
		ASSET_TYPE_ERC20 = { "assetClass": "ERC20", contract: toAddress(erc20Address) }

		ASSET_TYPE_CRYPTO_PUNK = {
			assetClass: "CRYPTO_PUNKS",
			contract: toAddress(cryptoPunksAddress),
			tokenId: punkIndex,
		}

		await erc20Mint(erc20, wallet1Address, wallet2Address, initErc20Balance)
		await verifyErc20Balance(erc20, wallet2Address, initErc20Balance)

		await cleanupTestEnvironment()
		printLog("Finished test init")
	}, 30000)

	afterEach(async () => {
		await cleanupTestEnvironment()
	})

	async function cleanupTestEnvironment() {
		printLog("Started cleaning up test environment")
		await transferPunkBackToInitialOwner()

		await cancelBidsInPunkMarket()
		await cancelOrderInPunkMarket()

		await cancelRaribleBids()
		await cancelRaribleOrders()

		await verifyErc721Balance(cryptoPunks1, wallet1Address, 10)
		await verifyErc721Balance(cryptoPunks1, wallet2Address, 0)
		await verifyErc721Balance(cryptoPunks1, wallet3Address, 0)

		await verifyCryptoPunkOwner(cryptoPunks1, punkIndex, wallet1Address)
		await awaitOwnershipValueToBe(nftOwnershipApi, cryptoPunksAddress, punkIndex, wallet1Address, 1)

		await awaitNoOwnership(nftOwnershipApi, cryptoPunksAddress, punkIndex, wallet2Address)
		await awaitNoOwnership(nftOwnershipApi, cryptoPunksAddress, punkIndex, wallet3Address)

		await cryptoPunks1.methods.withdraw().send({ from: wallet1Address })
		await cryptoPunks2.methods.withdraw().send({ from: wallet2Address })
		printLog("Finished cleaning up test environment")
	}

	test("check state before test", async () => {
	})

	test("test failed transfer by not an owner", async () => {
		await expect(async () => {
			await sdk2.nft.transfer(
				ASSET_TYPE_CRYPTO_PUNK,
				toAddress(wallet1Address)
			)
		}).rejects.toThrowError("has not any ownerships of token with Id")
	})

	test("test transfer", async () => {
		await sdk1.nft.transfer(ASSET_TYPE_CRYPTO_PUNK, toAddress(wallet2Address))
		await verifyCryptoPunkOwner(cryptoPunks1, punkIndex, wallet2Address)
		await awaitNoOwnership(nftOwnershipApi, cryptoPunksAddress, punkIndex, wallet1Address)
		await awaitOwnershipValueToBe(nftOwnershipApi, cryptoPunksAddress, punkIndex, wallet2Address, 1)
	}, 30000)

	test("test transfer using crypto punk market", async () => {
		await cryptoPunks1.methods.transferPunk(toAddress(wallet2Address), punkIndex).send({ from: wallet1Address })
		await verifyCryptoPunkOwner(cryptoPunks1, punkIndex, wallet2Address)
		await awaitNoOwnership(nftOwnershipApi, cryptoPunksAddress, punkIndex, wallet1Address)
		await awaitOwnershipValueToBe(nftOwnershipApi, cryptoPunksAddress, punkIndex, wallet2Address, 1)
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

		const balanceBefore2 = await web32.eth.getBalance(wallet2Address)

		if (withExistingRaribleBid) {
			const price = 17
			await createRaribleErc20BidOrder(price)
			await retry(3, async () => {
				const bids = await getRariblePunkBids()
				expectLength(bids, 1, "rarible bids count")
			})
		}

		if (withExistingPunkBid) {
			const bidPrice = 5
			await cryptoPunks2.methods.enterBidForPunk(punkIndex).send({ from: wallet2Address, value: bidPrice })
			await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(bidPrice).toString())
			await retry(3, async () => {
				const cryptoPunkBids = await getPunkMarketBids()
				expectLength(cryptoPunkBids, 1, "punk bids before buying")
			})
		}

		const price = 7
		let order: RaribleV2Order = await createRaribleEthSellOrder(price)

		const balanceBefore1 = await web31.eth.getBalance(wallet1Address)

		await runLogging("fill order", sdk2.order.fill({
			order,
			amount: 1,
		}))

		await retry(3, async () => {
			const orders = await getRariblePunkOrders()
			expectLength(orders, 0, "rarible orders count after sale")
		})

		if (withExistingRaribleBid) {
			// there is an active bid of wallet2 - of current owner of punk. it's ok
			await retry(3, async () => {
				const bids = await getRariblePunkBids()
				expectLength(bids, 1, "rarible bids count after buying")
			})
		}

		if (withExistingPunkBid) {
			// bid is deleted (it was deleted by punk market)
			await cryptoPunks2.methods.withdraw().send({ from: wallet2Address })
			await retry(3, async () => {
				const cryptoPunkBids = await getPunkMarketBids()
				expectLength(cryptoPunkBids, 0, "punk bids after buying")
			})

			await retry(3, async () => {
				const cryptoPunkBids = await getInactivePunkMarketBids()
				expectLength(cryptoPunkBids, 0, "inactive punk bids after buying")
			})
		}

		await verifyEthBalance(web31, toAddress(wallet1Address), toBn(balanceBefore1).plus(price).toString())
		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(price).toString())

		await verifyCryptoPunkOwner(cryptoPunks1, punkIndex, wallet2Address)
		await awaitNoOwnership(nftOwnershipApi, cryptoPunksAddress, punkIndex, wallet1Address)
		await awaitOwnershipValueToBe(nftOwnershipApi, cryptoPunksAddress, punkIndex, wallet2Address, 1)
	}

	test("test sell for erc20 by rarible order", async () => {
		const price = 24
		let order: RaribleV2Order = await createRaribleErc20SellOrder(price)
		await runLogging(
			"fill order",
			sdk2.order.fill({
				order,
				amount: 1,
			})
		)
		await verifyErc20Balance(erc20, wallet1Address, price)
		await verifyErc20Balance(erc20, wallet2Address, initErc20Balance - price)
		await verifyCryptoPunkOwner(cryptoPunks1, punkIndex, wallet2Address)
		await awaitNoOwnership(nftOwnershipApi, cryptoPunksAddress, punkIndex, wallet1Address)
		await awaitOwnershipValueToBe(nftOwnershipApi, cryptoPunksAddress, punkIndex, wallet2Address, 1)
	}, 30000)

	test("test sell by punk order", async () => {
		await sellByPunkOrder(false)
	}, 30000)

	test("test sell by punk order with existing rarible bid", async () => {
		await sellByPunkOrder(true)
	}, 30000)

	test("test sell by punk order with existing punk bid", async () => {
		await sellByPunkOrder(false, true)
	}, 30000)

	async function sellByPunkOrder(
		withExistingRaribleBid: boolean,
		withExistingPunkBid: boolean = false
	) {
		if (withExistingRaribleBid && withExistingPunkBid) {
			throw new Error("check supports case with either rarible or punk bid")
		}
		const balanceBefore2 = await web32.eth.getBalance(wallet2Address)
		if (withExistingRaribleBid) {
			const price = 17
			await createRaribleErc20BidOrder(price)
			await retry(3, async () => {
				const bids = await getRariblePunkBids()
				expectEqual(bids.length, 1, "rarible bids count")
			})
		}
		if (withExistingPunkBid) {
			const bidPrice = 5
			await cryptoPunks2.methods.enterBidForPunk(punkIndex).send({from: wallet2Address, value: bidPrice})
			await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(bidPrice).toString())
			await retry(3, async () => {
				const cryptoPunkBids = await getPunkMarketBids()
				expectLength(cryptoPunkBids, 1, "punk bids before buying")
			})
		}
		const minPrice = 8
		const order = await createPunkMarketSellOrder(minPrice, wallet1Address)

		await runLogging(
			"fill order",
			sdk2.order.fill({
				order,
				amount: 1,
				infinite: true,
			})
		)
		await retry(3, async () => {
			const orders = await getPunkMarketOrders()
			expectLength(orders, 0, "punk order after sale")
		})
		if (withExistingRaribleBid) {
			// there is an active bid of wallet2 - of current owner of punk. it's ok
			await retry(3, async () => {
				const bids = await getRariblePunkBids()
				expectLength(bids, 1, "rarible bids count after buying")
			})
		}
		if (withExistingPunkBid) {
			// bid is deleted (it was deleted by punk market)
			await cryptoPunks2.methods.withdraw().send({from: wallet2Address})
			await retry(3, async () => {
				const cryptoPunkBids = await getPunkMarketBids()
				expectLength(cryptoPunkBids, 0, "punk bids after buying")
			})
			await retry(3, async () => {
				const cryptoPunkBids = await getInactivePunkMarketBids()
				expectLength(cryptoPunkBids, 0, "inactive punk bids after buying")
			})
		}
		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(minPrice).toString())
		await verifyCryptoPunkOwner(cryptoPunks1, punkIndex, wallet2Address)
		await awaitNoOwnership(nftOwnershipApi, cryptoPunksAddress, punkIndex, wallet1Address)
		await awaitOwnershipValueToBe(nftOwnershipApi, cryptoPunksAddress, punkIndex, wallet2Address, 1)
	}

	test("test sell to address by punk order", async () => {
		const minPrice = 7
		await cryptoPunks1.methods.offerPunkForSaleToAddress(punkIndex, minPrice, wallet2Address)
			.send({from: wallet1Address})
		const forSale = await cryptoPunks1.methods.punksOfferedForSale(punkIndex).call()
		printLog(`forSale: ${JSON.stringify(forSale)}`)
		expectEqual(forSale.isForSale, true, "cryptoPunk offer.isForSale")
		expectEqual(forSale.seller.toLowerCase(), wallet1Address, "cryptoPunk offer.seller")
		expectEqual(forSale.onlySellTo.toLowerCase(), wallet2Address, "cryptoPunk offer.onlySellTo")
		const order = await retry(3, async () => {
			const orders = await getPunkMarketOrders()
			expectLength(orders, 1, "punk orders count")
			return orders[0]
		})
		printLog(`order: ${JSON.stringify(order)}`)
		checkSellOrder(order, {assetClass: "ETH"}, minPrice, wallet2Address)
		const balanceBefore = await web32.eth.getBalance(wallet2Address)
		runLogging(
			"fill order",
			sdk2.order.fill({
				order,
				amount: 1,
				infinite: true,
			})
		)
		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore).minus(minPrice).toString())
		await verifyCryptoPunkOwner(cryptoPunks1, punkIndex, wallet2Address)
		await awaitNoOwnership(nftOwnershipApi, cryptoPunksAddress, punkIndex, wallet1Address)
		await awaitOwnershipValueToBe(nftOwnershipApi, cryptoPunksAddress, punkIndex, wallet2Address, 1)
	}, 30000)

	test("test create punk order with existing rarible order", async () => {
		// create rarible order
		const price = 7
		await createRaribleEthSellOrder(price)

		// create punk order
		const minPrice = 8
		await cryptoPunks1.methods.offerPunkForSale(punkIndex, minPrice).send({from: wallet1Address})
		const forSale = await cryptoPunks1.methods.punksOfferedForSale(punkIndex).call()
		expectEqual(forSale.isForSale, true, "cryptoPunk offer.isForSale")
		expectEqual(forSale.seller.toLowerCase(), wallet1Address, "cryptoPunk offer.seller")
		expectEqual(forSale.minValue, minPrice.toString(), "cryptoPunk offer.minValue")
		expectEqual(forSale.onlySellTo, ZERO_ADDRESS, "cryptoPunk offer.onlySellTo")
		// expected: 1 punk order, no one rarible order
		let punkOrder = await retry(3, async () => {
			const orders = await getPunkMarketOrders()
			expectLength(orders, 1, "punk orders count")
			return orders[0]
		})
		printLog(`punk order: ${JSON.stringify(punkOrder)}`)
		checkSellOrder(punkOrder, {assetClass: "ETH"}, minPrice)
		// todo error
		// rarible order must be deleted, because there is no Offer(price: 0, onlySellTo: proxy) anymore
		// whereas rarible order needs such offer for executing
		await retry(3, async () => {
			const orders = await getRariblePunkOrders()
			expectLength(orders, 0, "rarible orders count after creating punk order")
		})
		// // рарибл ордер должен был быть удален
		// // это подтверждение, что он нерабочий.
		// // (так как для его выполнения должен быть ордер в панко-контракте с onlySellTo=proxy и др. полями,
		// // а мы этот ордер перетерли нативным панко-ордером)
		// const raribleOrder = await retry(3, async () => {
		// 	const orders = await getRariblePunkOrders()
		// 	expect(orders.length).toBeGreaterThan(0)
		// 	return orders[0]
		// })
		// try {
		// 	await sdk2.order.fill({
		// 		order: raribleOrder,
		// 		amount: 1,
		// 	})
		// } catch (e) {
		// 	printLog(`order.fill failed with error: ${e}`)
		// 	throw new Error(`order.fill failed with error: ${e}`)
		// }
		// await verifyCryptoPunkOwner(cryptoPunks1, punkIndex, wallet2Address)
	}, 30000)

	test("test create rarible order with existing punk order", async () => {
		// create punk order
		const minPrice = 8
		await cryptoPunks1.methods.offerPunkForSale(punkIndex, minPrice).send({from: wallet1Address})
		const forSale = await cryptoPunks1.methods.punksOfferedForSale(punkIndex).call()
		expectEqual(forSale.isForSale, true, "cryptoPunk offer.isForSale")
		expectEqual(forSale.seller.toLowerCase(), wallet1Address, "cryptoPunk offer.seller")
		expectEqual(forSale.minValue, minPrice.toString(), "cryptoPunk offer.minValue")
		expectEqual(forSale.onlySellTo, ZERO_ADDRESS, "cryptoPunk offer.onlySellTo")
		let punkOrder = await retry(3, async () => {
			const orders = await getPunkMarketOrders()
			expectLength(orders, 1, "punk orders count")
			return orders[0]
		})
		printLog(`punk order: ${JSON.stringify(punkOrder)}`)
		checkSellOrder(punkOrder, {assetClass: "ETH"}, minPrice)
		// create rarible order
		const price = 7
		await createRaribleEthSellOrder(price)

		const forSaleForProxy = await cryptoPunks1.methods.punksOfferedForSale(punkIndex).call()
		expectEqual(forSaleForProxy.minValue, "0", "for proxy offer.minValue")
		expectEqual(forSaleForProxy.onlySellTo !== ZERO_ADDRESS, true, "for proxy only sell to must be filled")
		// todo error
		// punk order must be deleted, because there is Offer(price: 0, onlySellTo: proxy) for proxy
		// thus punk order isn't executable anymore
		await retry(3, async () => {
			const orders = await getPunkMarketOrders()
			expectLength(orders, 0, "punk orders count after rarible order is created")
		})
		// // punk должен был быть удален
		// // это подтверждение, что он нерабочий
		// const cryptoPunkOrder = await retry(3, async () => {
		// 	const orders = await getPunkMarketOrders()
		// 	expect(orders.length).toBeGreaterThan(0)
		// 	return orders[0]
		// })
		// try {
		// 	await sdk2.order.fill({
		// 		order: cryptoPunkOrder,
		// 		amount: 1,
		// 	})
		// } catch (e) {
		// 	printLog(`order.fill failed with error: ${e}`)
		// 	throw new Error(`order.fill failed with error: ${e}`)
		// }
		// await verifyCryptoPunkOwner(cryptoPunks1, punkIndex, wallet2Address)
	}, 30000)

	test("test cancel rarible order", async () => {
		const price = 24
		let order = await createRaribleErc20SellOrder(price)
		await sdk1.order.cancel(order)
		await retry(3, async () => {
			const orders = await getRariblePunkOrders()
			expectLength(orders, 0, "orders count from api after cancel")
		})
	}, 30000)

	test("test cancel sell by punk market", async () => {
		const minPrice = 8
		await cryptoPunks1.methods.offerPunkForSale(punkIndex, minPrice).send({from: wallet1Address})
		const forSaleTrue = await cryptoPunks1.methods.punksOfferedForSale(punkIndex).call()
		printLog(`forSale: ${JSON.stringify(forSaleTrue)}`)
		expectEqual(forSaleTrue.isForSale, true, "cryptoPunk offer.isForSale")
		await retry(3, async () => {
			const orders = await getPunkMarketOrders()
			expectLength(orders, 1, "punk orders count")
		})
		await cryptoPunks1.methods.punkNoLongerForSale(punkIndex).send({from: wallet1Address})
		const forSale = await cryptoPunks1.methods.punksOfferedForSale(punkIndex).call()
		printLog(`cancelled forSale: ${JSON.stringify(forSale)}`)
		expectEqual(forSale.isForSale, false, "cryptoPunk cancelled offer.isForSale")
		await retry(3, async () => {
			const orders = await getPunkMarketOrders()
			expectLength(orders, 0, "punk orders count from api")
		})
	}, 30000)

	test("test cancel sell by punk market using api", async () => {
		const minPrice = 8
		await cryptoPunks1.methods.offerPunkForSale(punkIndex, minPrice).send({from: wallet1Address})
		const forSaleTrue = await cryptoPunks1.methods.punksOfferedForSale(punkIndex).call()
		printLog(`forSale: ${JSON.stringify(forSaleTrue)}`)
		expectEqual(forSaleTrue.isForSale, true, "cryptoPunk offer.isForSale")
		const order = await retry(3, async () => {
			const orders = await getPunkMarketOrders()
			expectLength(orders, 1, "punk orders count")
			return orders[0]
		})
		await runLogging(
			"cancell order",
			sdk1.order.cancel(order)
		)
		const forSale = await cryptoPunks1.methods.punksOfferedForSale(punkIndex).call()
		printLog(`cancelled forSale: ${JSON.stringify(forSale)}`)
		expectEqual(forSale.isForSale, false, "cryptoPunk cancelled offer.isForSale")
		await retry(3, async () => {
			const orders = await getPunkMarketOrders()
			expectLength(orders, 0, "punk orders count from api")
		})
	}, 30000)

	test("test update sell by punk market using api", async () => {
		const minPrice = 8
		await cryptoPunks1.methods.offerPunkForSale(punkIndex, minPrice).send({from: wallet1Address})
		const forSale = await cryptoPunks1.methods.punksOfferedForSale(punkIndex).call()
		printLog(`forSale: ${JSON.stringify(forSale)}`)
		expectEqual(forSale.isForSale, true, "cryptoPunk offer.isForSale")
		expectEqual(forSale.minValue, minPrice.toString(), "cryptoPunk offer.minValue")
		const order = await retry(3, async () => {
			const orders = await getPunkMarketOrders()
			expectLength(orders, 1, "punk orders count")
			return orders[0]
		})
		const newMinPrice = 10
		await runLogging(
			"update sell order",
			sdk1.order.sellUpdate({
				order,
				price: newMinPrice,
			})
		)
		const forSaleUpdated = await cryptoPunks1.methods.punksOfferedForSale(punkIndex).call()
		printLog(`updated forSale: ${JSON.stringify(forSaleUpdated)}`)
		expectEqual(forSaleUpdated.isForSale, true, "cryptoPunk updated offer.isForSale")
		expectEqual(forSaleUpdated.minValue, "0", "cryptoPunk updated offer.minValue")
		await retry(3, async () => {
			const orders = await getRariblePunkOrders()
			expectLength(orders, 1, "rarible orders count after update")
			const order = orders[0]
			expectEqual(order.take.value, newMinPrice.toString(), "updated sell order: take.value")
		})
		//todo ошибка: предыдущего панк-ордера не должно быть
		await retry(3, async () => {
			const orders = await getPunkMarketOrders()
			expectLength(orders, 0, "punk orders count after update")
		})
	}, 30000)

	test("test punk order and transfer", async () => {
		await cryptoPunks1.methods.offerPunkForSale(punkIndex, 8).send({from: wallet1Address})
		const forSale = await cryptoPunks1.methods.punksOfferedForSale(punkIndex).call()
		expectEqual(forSale.isForSale, true, "cryptoPunk offer.isForSale")
		await retry(3, async () => {
			const orders = await getPunkMarketOrders()
			expectLength(orders, 1, "punk orders count")
		})
		await sdk1.nft.transfer(ASSET_TYPE_CRYPTO_PUNK, toAddress(wallet2Address))
		const forSaleCancelled = await cryptoPunks1.methods.punksOfferedForSale(punkIndex).call()
		expectEqual(forSaleCancelled.isForSale, false, "cryptoPunk offer.isForSale after transfer")
		// punk order is deleted
		await retry(3, async () => {
			const orders = await getPunkMarketOrders()
			expectLength(orders, 0, "punk orders count after transfer")
		})
		await retry(3, async () => {
			const orders = await getInactivePunkMarketOrders()
			expectLength(orders, 0, "inactive punk orders count after transfer")
		})
	}, 30000)

	test("test cancel bid by punk market", async () => {
		const price = 8
		const balanceBefore2 = await web32.eth.getBalance(wallet2Address)
		await cryptoPunks2.methods.enterBidForPunk(punkIndex).send({from: wallet2Address, value: price})
		const cryptoPunkBid = await cryptoPunks2.methods.punkBids(punkIndex).call()
		expectEqual(cryptoPunkBid.hasBid, true, "cryptoPunkBid.hasBid")
		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(price).toString())
		await retry(3, async () => {
			const bids = await getPunkMarketBids()
			expectLength(bids, 1, "punk bids count")
		})
		await cryptoPunks2.methods.withdrawBidForPunk(punkIndex).send({from: wallet2Address})
		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).toString())
		const cryptoPunkCancelledBid = await cryptoPunks2.methods.punkBids(punkIndex).call()
		expectEqual(cryptoPunkCancelledBid.hasBid, false, "cancelled bid.hasBid")
		await retry(3, async () => {
			const bids = await getPunkMarketBids()
			expectLength(bids, 0, "punk bids count from api")
		})
	}, 30000)

	test("test cancel bid by punk market using api", async () => {
		const price = 8
		const balanceBefore2 = await web32.eth.getBalance(wallet2Address)
		await cryptoPunks2.methods.enterBidForPunk(punkIndex).send({from: wallet2Address, value: price})
		const cryptoPunkBid = await cryptoPunks2.methods.punkBids(punkIndex).call()
		expectEqual(cryptoPunkBid.hasBid, true, "cryptoPunkBid.hasBid")
		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(price).toString())
		const bid = await retry(3, async () => {
			const bids = await getPunkMarketBids()
			expectLength(bids, 1, "punk bids count")
			return bids[0]
		})
		await runLogging(
			"cancel bid order",
			sdk2.order.cancel(bid)
		)
		const cryptoPunkCancelledBid = await cryptoPunks2.methods.punkBids(punkIndex).call()
		expectEqual(cryptoPunkCancelledBid.hasBid, false, "cancelled bid.hasBid")
		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).toString())
		await retry(3, async () => {
			const cryptoPunkBids = await getPunkMarketBids()
			expectLength(cryptoPunkBids, 0, "punk bids count from api")
		})
	}, 30000)

	test("test update bid by punk market", async () => {
		const price = 8
		const balanceBefore2 = await web32.eth.getBalance(wallet2Address)
		await cryptoPunks2.methods.enterBidForPunk(punkIndex).send({from: wallet2Address, value: price})
		const cryptoPunkBid = await cryptoPunks2.methods.punkBids(punkIndex).call()
		expectEqual(cryptoPunkBid.hasBid, true, "cryptoPunkBid.hasBid")
		expectEqual(cryptoPunkBid.value, price.toString(), "cryptoPunkBid.value")
		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(price).toString())
		await retry(3, async () => {
			const bids = await getPunkMarketBids()
			expectLength(bids, 1, "punk bids count")
			const bid = bids[0]
			expectEqual(bid.make.value, price.toString(), "updated bid: make.value")
		})
		const newPrice = 10//todo check на понижение
		await cryptoPunks2.methods.enterBidForPunk(punkIndex).send({from: wallet2Address, value: newPrice})
		const cryptoPunkBidUpdated = await cryptoPunks2.methods.punkBids(punkIndex).call()
		expectEqual(cryptoPunkBidUpdated.hasBid, true, "cryptoPunkBid updated .hasBid")
		expectEqual(cryptoPunkBidUpdated.value, newPrice.toString(), "cryptoPunkBid updated .value")
		await cryptoPunks2.methods.withdraw().send({from: wallet2Address})
		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(newPrice).toString())
		await retry(3, async () => {
			const bids = await getPunkMarketBids()
			expectLength(bids, 1, "punk bids count after update")
			const bid = bids[0]
			expectEqual(bid.make.value, newPrice.toString(), "updated bid: make.value")
		})
	}, 30000)

	test("test update bid by punk market using api", async () => {
		const price = 8
		const balanceBefore2 = await web32.eth.getBalance(wallet2Address)
		await cryptoPunks2.methods.enterBidForPunk(punkIndex).send({from: wallet2Address, value: price})
		const cryptoPunkBid = await cryptoPunks2.methods.punkBids(punkIndex).call()
		expectEqual(cryptoPunkBid.hasBid, true, "cryptoPunkBid.hasBid")
		expectEqual(cryptoPunkBid.value, price.toString(), "cryptoPunkBid.value")
		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(price).toString())
		const bid = await retry(3, async () => {
			const bids = await getPunkMarketBids()
			expectLength(bids, 1, "punk bids count")
			return bids[0]
		})
		const newPrice = 10
		await runLogging(
			"update bid",
			sdk2.order.bidUpdate({
				order: bid,
				price: newPrice,
			})
		)
		const cryptoPunkBidUpdated = await cryptoPunks2.methods.punkBids(punkIndex).call()
		expectEqual(cryptoPunkBidUpdated.hasBid, true, "cryptoPunkBid hasBid after update")
		expectEqual(cryptoPunkBidUpdated.value, price.toString(), "cryptoPunkBid value after update")
		await cryptoPunks2.methods.withdraw().send({from: wallet2Address})
		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(price).toString())
		await retry(3, async () => {
			const bids = await getRariblePunkBids()
			expectLength(bids, 1, "rarible bids count after update")
			const bid = bids[0]
			expectEqual(bid.make.value, newPrice.toString(), "updated bid: make.value")
		})
		await retry(3, async () => {
			const bids = await getPunkMarketBids()
			expectLength(bids, 1, "punk bids count after update")
			expectEqual(bid.make.value, price.toString(), "punk bid: make.value after update")
		})
	}, 30000)

	test("test punk bids from different users", async () => {
		const price = 8
		await cryptoPunks2.methods.enterBidForPunk(punkIndex).send({from: wallet2Address, value: price})
		const cryptoPunkBid = await cryptoPunks2.methods.punkBids(punkIndex).call()
		expectEqual(cryptoPunkBid.hasBid, true, "cryptoPunkBid.hasBid")
		expectEqual(cryptoPunkBid.bidder.toLowerCase(), wallet2Address, "cryptoPunkBid.bidder")
		expectEqual(cryptoPunkBid.value, price.toString(), "cryptoPunkBid.value")
		await retry(3, async () => {
			const bids = await getPunkMarketBids()
			expectLength(bids, 1, "punk bids count")
		})
		const newPrice = 10
		await cryptoPunks3.methods.enterBidForPunk(punkIndex).send({from: wallet3Address, value: newPrice})
		const newCryptoPunkBid = await cryptoPunks3.methods.punkBids(punkIndex).call()
		expectEqual(newCryptoPunkBid.hasBid, true, "new cryptoPunkBid.hasBid")
		expectEqual(newCryptoPunkBid.bidder.toLowerCase(), wallet3Address, "new cryptoPunkBid.bidder")
		expectEqual(newCryptoPunkBid.value, newPrice.toString(), "new cryptoPunkBid.value")
		// todo ошибка: на протоколе 2 активных панк-бида, хотя д б 1,
		//  т к в контракте не может быть больше 1 активного панка-бида
		//  только один из них реализуем - у которотого есть соответствие в контракте, остальные д б удалены/отменены
		// previous punk bid is deleted, because it was replaced in punk contract by new punk bid
		await retry(3, async () => {
			const bids = await getPunkMarketBids()
			expectLength(bids, 1, "punk bids count after new bid")
		})
		await retry(3, async () => {
			const bids = await getInactivePunkMarketOrders()
			expectLength(bids, 0, "inactive punk bids count after new bid")
		})
	}, 30000)

	test("test bid by punk market and transfer", async () => {
		const price = 8
		const balanceBefore2 = await web32.eth.getBalance(wallet2Address)
		await cryptoPunks2.methods.enterBidForPunk(punkIndex).send({from: wallet2Address, value: price})
		const cryptoPunkBid = await cryptoPunks2.methods.punkBids(punkIndex).call()
		expectEqual(cryptoPunkBid.hasBid, true, "cryptoPunkBid.hasBid")
		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(price).toString())
		await retry(3, async () => {
			const bids = await getPunkMarketBids()
			expectLength(bids, 1, "punk bids count")
		})
		await sdk1.nft.transfer(ASSET_TYPE_CRYPTO_PUNK, toAddress(wallet2Address))
		const cryptoPunkCancelledBid = await cryptoPunks2.methods.punkBids(punkIndex).call()
		expectEqual(cryptoPunkCancelledBid.hasBid, false, "punk bid.hasBid after transferring")
		// todo ошибка: punk бид д б удален, т к в контракте нет его соответствия.
		//  его невозможно ни реализовать ни отменить. стейт патовый
		//  чинится только созданием заново панк-бида и потом уже отменой (cancelBrokenPunkBid)
		// punk bid is deleted
		await retry(3, async () => {
			const bids = await getPunkMarketBids()
			expectLength(bids, 0, "punk bids count after transfer")
		})
	}, 30000)

	test("test punk bid and rarible bid creation", async () => {
		await cryptoPunks2.methods.enterBidForPunk(punkIndex).send({from: wallet2Address, value: 8})
		const cryptoPunkBid = await cryptoPunks2.methods.punkBids(punkIndex).call()
		expectEqual(cryptoPunkBid.hasBid, true, "cryptoPunkBid.hasBid")
		const price = 10
		await createRaribleErc20BidOrder(price)
		await retry(3, async () => {
			const bids = await getPunkMarketBids()
			expectLength(bids, 1, "punk bids count")
		})
		await retry(3, async () => {
			const bids = await getRariblePunkBids()
			expectLength(bids, 1, "rarible bids count")
		})
	}, 30000)

	test("test buy using rarible bid with erc20", async () => {
		await buyUsingRaribleBid(false)
	}, 30000)

	test("test buy using rarible bid with erc20 with existing rarible order", async () => {
		await buyUsingRaribleBid(true)
	}, 30000)

	test("test buy using rarible bid with erc20 with existing punk order", async () => {
		await buyUsingRaribleBid(false, true)
	}, 30000)

	async function buyUsingRaribleBid(
		withExistingRaribleOrder: boolean,
		withExistingPunkOrder: boolean = false
	) {
		if (withExistingRaribleOrder && withExistingPunkOrder) {
			throw new Error("check supports case with either rarible or punk order")
		}
		if (withExistingRaribleOrder) {
			const price = 10
			await createRaribleEthSellOrder(price)
		}
		if (withExistingPunkOrder) {
			const minPrice = 28
			await cryptoPunks1.methods.offerPunkForSale(punkIndex, minPrice).send({from: wallet1Address})
			await retry(3, async () => {
				const orders = await getPunkMarketOrders()
				expectLength(orders, 1, "punk order before bid")
			})
		}
		const price = 24
		const createdBid: RaribleV2Order = await createRaribleErc20BidOrder(price)
		let bid = await retry(3, async () => {
			const bids = await getRariblePunkBids()
			expectLength(bids, 1, "rarible bids count")
			return bids[0]
		})
		expectEqual(bid.maker, createdBid.maker, "bid.maker")
		expectEqual(bid.make.assetType.assetClass, createdBid.make.assetType.assetClass, "bid.make.assetType")
		expectEqual(bid.make.valueDecimal, createdBid.make.valueDecimal, "bid.make.valueDecimal")
		expectEqual(bid.take.assetType.assetClass, createdBid.take.assetType.assetClass, "bid.take.assetType")
		await runLogging(
			"fill order",
			sdk1.order.fill({
				order: bid,
				amount: price,
			})
		)
		await verifyErc20Balance(erc20, wallet1Address, price)
		await verifyErc20Balance(erc20, wallet2Address, initErc20Balance - price)
		await verifyCryptoPunkOwner(cryptoPunks1, punkIndex, wallet2Address)
		await awaitNoOwnership(nftOwnershipApi, cryptoPunksAddress, punkIndex, wallet1Address)
		await awaitOwnershipValueToBe(nftOwnershipApi, cryptoPunksAddress, punkIndex, wallet2Address, 1)
		if (withExistingRaribleOrder) {
			await retry(3, async () => {
				const orders = await getRariblePunkOrders()
				expectLength(orders, 0, "rarible order after accepting bid")
			})
			// todo error: при accept bid sell-ордер стал со статусом inactive. т е после возвращения панка владельцу
			// ордера он опять активный, хотя нереализуем
			// (т к при accept bid идет transfer и записывается Offer(isForSale=false))
			await retry(3, async () => {
				const orders = await getInactiveRaribleOrders()
				expectLength(orders, 0, "inactive rarible order after accepting bid")
			})
			// transfer punk back and check that there is still no rarible order
			await transferPunkBackToInitialOwner()
			await retry(3, async () => {
				const orders = await getRariblePunkOrders()
				expectLength(orders, 0, "rarible orders count after accepting bid")
			})
			// // это подтверждение, что ордер нереализуем (панк д б у wallet1)
			// const order = await retry(3, async () => {
			// 	const orders = await getRariblePunkOrders()
			// 	expectLength(orders, 1, "rarible order after accepting bid")
			// 	return orders[0]
			// })
			// try {
			// 	await sdk2.order.fill({
			// 		order: order,
			// 		amount: 1,
			// 	})
			// } catch (e) {
			// 	printLog(`order.fill failed with error: ${e}`)
			// 	throw new Error(`order.fill failed with error: ${e}`)
			// }
			// await verifyCryptoPunkOwner(cryptoPunks1, punkIndex, wallet2Address)
		}
		if (withExistingPunkOrder) {
			await retry(3, async () => {
				const orders = await getPunkMarketOrders()
				expectLength(orders, 0, "punk order after accepting bid")
			})
			// todo error: при accept bid sell-ордер стал со статусом inactive. т е после возвращения панка владельцу
			// ордера он опять активный, хотя нереализуем
			// (т к при accept bid идет transfer и записывается Offer(isForSale=false))
			await retry(3, async () => {
				const orders = await getInactivePunkMarketOrders()
				expectLength(orders, 0, "inactive punk order after accepting bid")
			})
			// transfer punk back and check that there is still no punk order
			await transferPunkBackToInitialOwner()
			// todo тут тоже ошибка. он inactive, значит при получении панка назад ордер д б active,
			//  но он все равно inactive
			await retry(3, async () => {
				const orders = await getPunkMarketOrders()
				expectLength(orders, 1, "punk orders count after transferring back")
			})
		}
	}

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
		if (withExistingRaribleOrder) {
			const price = 10
			await createRaribleEthSellOrder(price)
		}
		if (withExistingPunkOrder) {
			const minPrice = 28
			await cryptoPunks1.methods.offerPunkForSale(punkIndex, minPrice).send({from: wallet1Address})
			await retry(3, async () => {
				const orders = await getPunkMarketOrders()
				expectLength(orders, 1, "punk order before bid")
			})
		}
		const price = 5
		const punkMarketBid = await createPunkMarketBid(price)
		await runLogging(
			"fill order",
			sdk1.order.fill({
				order: punkMarketBid,
				amount: 1,
				infinite: true,
			})
		)
		await checkApiNoMarketBids()

		await withdrawEth(wallet1Address, price)

		await verifyCryptoPunkOwner(cryptoPunks2, punkIndex, wallet2Address)
		await awaitNoOwnership(nftOwnershipApi, cryptoPunksAddress, punkIndex, wallet1Address)
		await awaitOwnershipValueToBe(nftOwnershipApi, cryptoPunksAddress, punkIndex, wallet2Address, 1)

		if (withExistingRaribleOrder) {
			await retry(3, async () => {
				const orders = await getRariblePunkOrders()
				expectLength(orders, 0, "rarible order after accepting bid")
			})
			// todo error: при accept bid sell-ордер стал со статусом inactive. т е после возвращения панка владельцу
			// ордера он опять активный, хотя нереализуем (т к при accept bid записывается Offer(isForSale=false)
			await retry(3, async () => {
				const orders = await getInactiveRaribleOrders()
				expectLength(orders, 0, "inactive rarible order after accepting bid")
			})
			// transfer punk back and check that there is still no rarible order
			await transferPunkBackToInitialOwner()
			await retry(3, async () => {
				const orders = await getRariblePunkOrders()
				expectLength(orders, 0, "rarible orders count after accepting bid")
			})
			// // это подтверждение, что ордер нереализуем
			// const order = await retry(3, async () => {
			// 	const orders = await getRariblePunkOrders()
			// 	expectLength(orders, 1, "rarible order after accepting bid")
			// 	return orders[0]
			// })
			// try {
			// 	await sdk2.order.fill({
			// 		order: order,
			// 		amount: 1,
			// 	})
			// } catch (e) {
			// 	printLog(`order.fill failed with error: ${e}`)
			// 	throw new Error(`order.fill failed with error: ${e}`)
			// }
			// await verifyCryptoPunkOwner(cryptoPunks1, punkIndex, wallet2Address)
		}
		if (withExistingPunkOrder) {
			await retry(3, async () => {
				const orders = await getPunkMarketOrders()
				expectLength(orders, 0, "punk order after accepting bid")
			})
			// todo error: при accept bid sell-ордер стал со статусом inactive. т е после возвращения панка владельцу
			// ордера он опять активный, хотя нереализуем (т к при accept bid записывается Offer(isForSale=false)
			await retry(3, async () => {
				const orders = await getInactivePunkMarketOrders()
				expectLength(orders, 0, "inactive punk order after accepting bid")
			})
			// transfer punk back and check that there is still no punk order
			await transferPunkBackToInitialOwner()
			// todo тут тоже ошибка. он inactive, значит при получении панка назад ордер д б active,
			//  но он все равно inactive
			await retry(3, async () => {
				const orders = await getPunkMarketOrders()
				expectLength(orders, 1, "punk orders count after transferring back")
			})
		}
	}

	// ---------------------- UTILITY FUNCTIONS ----------------------

	/**
	 * Creates sell order from [wallet] in the punk market.
	 */
	async function createPunkMarketSellOrder(
		price: number,
		wallet: string = wallet1Address
	): Promise<CryptoPunkOrder> {
		const contract = getPunkMarketContractByAddress(wallet)
		await contract.methods.offerPunkForSale(punkIndex, price).send({from: wallet})
		const rawSell = await contract.methods.punksOfferedForSale(punkIndex).call()
		expectEqual(rawSell.isForSale, true, "rawSell.isForSale")
		expectEqual(rawSell.seller.toLowerCase(), wallet, "rawSell.seller")
		expectEqual(rawSell.minValue, price.toString(), "rawSell.minValue")
		expectEqual(rawSell.punkIndex, punkIndex.toString(), "rawSell.punkIndex")
		let order = await retry(3, async () => {
			const orders = await getPunkMarketOrders()
			expectLength(orders, 1, "punk market orders count")
			return orders[0]
		})
		printLog(`Created punk market order: ${JSON.stringify(order)}`)
		checkSellOrder(order, { assetClass: "ETH" }, price)
		return order
	}

	/**
	 * Creates bid from [wallet] in the punk market.
	 */
	async function createPunkMarketBid(
		price: number,
		wallet: string = wallet2Address
	): Promise<CryptoPunkOrder> {
		const balanceBefore = await web32.eth.getBalance(wallet)
		const contract = getPunkMarketContractByAddress(wallet)
		await contract.methods.enterBidForPunk(punkIndex).send({from: wallet, value: price})
		await verifyEthBalance(web32, toAddress(wallet), toBn(balanceBefore).minus(price).toString())
		const rawBid = await contract.methods.punkBids(punkIndex).call()
		printLog(`Raw punk market bid: ${JSON.stringify(rawBid)}`)
		expectEqual(rawBid.hasBid, true, "rawBid.hasBid")
		expectEqual(rawBid.bidder.toLowerCase(), wallet, "rawBid.bidder")
		expectEqual(rawBid.value, price.toString(), "rawBid.value")
		expectEqual(rawBid.punkIndex, punkIndex.toString(), "rawBid.punkIndex")
		const bid = await retry(3, async () => {
			const cryptoPunkBids = await getPunkMarketBids()
			expectLength(cryptoPunkBids, 1, "created punk market bids")
			return cryptoPunkBids[0]
		})
		printLog(`Created CRYPTO_PUNK bid: ${JSON.stringify(bid)}`)
		checkBid(bid, ASSET_TYPE_ETH, price)
		return bid
	}

	/**
	 * Creates RaribleV2 ERC20 punk bid.
	 */
	async function createRaribleErc20BidOrder(price: number): Promise<RaribleV2Order> {
		return createRaribleBidOrder(ASSET_TYPE_ERC20, price)
	}

	/**
	 * @see createRaribleErc20BidOrder
	 */
	async function createRaribleBidOrder(
		makeAssetType: EthAssetType | Erc20AssetType,
		price: number
	): Promise<RaribleV2Order> {
		let isErc20 = "contract" in makeAssetType
		let bidOrder = await runLogging(
			`create ${isErc20 ? "ERC20" : "ETH"} bid order with price ${price}`,
			sdk2.order.bid({
				makeAssetType: makeAssetType,
				amount: 1,
				maker: toAddress(wallet2Address),
				originFees: [],
				payouts: [],
				price: 10,
				takeAssetType: ASSET_TYPE_CRYPTO_PUNK,
			}).then((order) => order as RaribleV2Order)
		)
		printLog(`Created RaribleV2 bid order: ${JSON.stringify(bidOrder)}`)
		checkBid(bidOrder, makeAssetType, price)
		return bidOrder
	}

	async function createRaribleEthSellOrder(price: number): Promise<RaribleV2Order> {
		return createRaribleSellOrder(ASSET_TYPE_ETH, price)
	}

	async function createRaribleErc20SellOrder(price: number): Promise<RaribleV2Order> {
		return createRaribleSellOrder(ASSET_TYPE_ERC20, price)
	}

	async function createRaribleSellOrder(
		takeAssetType: EthAssetType | Erc20AssetType,
		price: number
	): Promise<RaribleV2Order> {
		let isErc20 = "contract" in takeAssetType
		let sellOrder = await runLogging(
			`create ${isErc20 ? "ERC20" : "ETH"} sell order with price ${price}`,
			sdk1.order.sell({
				makeAssetType: ASSET_TYPE_CRYPTO_PUNK,
				amount: 1,
				maker: toAddress(wallet1Address),
				originFees: [],
				payouts: [],
				price: price,
				takeAssetType: takeAssetType,
			}).then((order) => order as RaribleV2Order)
		)
		checkSellOrder(sellOrder, takeAssetType, price)
		await retry(3, async () => {
			const orders = await getRariblePunkOrders()
			expectLength(orders, 1, "rarible order before bid")
		})
		printLog(`created sell order: ${JSON.stringify(sellOrder)}`)
		return sellOrder
	}

	/**
	 * Returns punk to wallet1.
	 */
	async function transferPunkBackToInitialOwner() {
		const punkOwner = await cryptoPunks1.methods.punkIndexToAddress(punkIndex).call()
		if (punkOwner.toLowerCase() === wallet1Address) {
			printLog("no need to transfer back, the punk belongs to wallet1")
			return
		}
		if (punkOwner.toLowerCase() !== wallet2Address) {
			throw Error(`Punk with id ${punkIndex} is owned by the third side user: ${punkOwner}`)
		}
		printLog("transferring back from wallet2 to wallet1")
		await verifyCryptoPunkOwner(cryptoPunks1, punkIndex, wallet2Address)
		await awaitOwnershipValueToBe(nftOwnershipApi, cryptoPunksAddress, punkIndex, wallet2Address, 1)

		await cryptoPunks2.methods.transferPunk(toAddress(wallet1Address), punkIndex).send({ from: wallet2Address })
		await verifyCryptoPunkOwner(cryptoPunks1, punkIndex, wallet1Address)
		await awaitNoOwnership(nftOwnershipApi, cryptoPunksAddress, punkIndex, wallet2Address)
		await awaitOwnershipValueToBe(nftOwnershipApi, cryptoPunksAddress, punkIndex, wallet1Address, 1)
		printLog("punk transferred back to wallet1")
	}

	/**
	 * Withdraw ETH from punk market to wallet.
	 */
	async function withdrawEth(wallet: string, expectedPlus: number) {
		const web3 = getWeb3ByAddress(wallet)
		const contract = getPunkMarketContractByAddress(wallet)
		const balanceBefore = await web3.eth.getBalance(wallet)
		await contract.methods.withdraw().send({from: wallet})
		await verifyEthBalance(web3, toAddress(wallet), toBn(balanceBefore).plus(expectedPlus).toString())
	}

	/**
	 * Cancels Rarible sell orders via API.
	 */
	async function cancelRaribleOrders() {
		const orders = await getRariblePunkOrders()
		if (orders.length === 0) {
			printLog("No Rarible sell orders to cancel")
			return
		}
		printLog(`orders to cancel ${orders.length}: ${JSON.stringify(orders)}`)

		for (const order of orders) {
			const sdk = getSdkByAddress(order.maker.toString().toLowerCase())
			await runLogging(
				`cancel sell order ${order}`,
				sdk.order.cancel(order)
			)
		}

		await checkApiNoRaribleOrders()
	}

	/**
	 * Cancels Rarible punk bids via API.
	 */
	async function cancelRaribleBids() {
		const bids = await getRariblePunkBids()
		if (bids.length === 0) {
			printLog("No Rarible bids to cancel")
			return
		}
		printLog(`Bids to cancel: ${bids.length}: ${JSON.stringify(bids)}`)

		for (const bid of bids) {
			const sdk = getSdkByAddress(bid.maker.toString().toLowerCase())
			await runLogging(
				`cancel bid ${JSON.stringify(bid)}`,
				sdk.order.cancel(bid)
			)
		}
		await checkApiNoRaribleBids()
	}

	/**
	 * Returns Web3 (1/2/3) for the given wallet.
	 */
	function getWeb3ByAddress(address: string): Web3 {
		if (address.toLowerCase() === wallet1Address) {
			return web31
		}
		if (address.toLowerCase() === wallet2Address) {
			return web32
		}
		expectEqual(address.toLowerCase(), wallet3Address, "unknown address")
		return web33
	}

	/**
	 * Returns SDK (1/2/3) for the given wallet.
	 */
	function getSdkByAddress(address: string): RaribleSdk {
		if (address.toLowerCase() === wallet1Address) {
			return sdk1
		}
		if (address.toLowerCase() === wallet2Address) {
			return sdk2
		}
		expectEqual(address.toLowerCase(), wallet3Address, "unknown address")
		return sdk3
	}

	/**
	 * Returns the punk market contract for the given wallet.
	 */
	function getPunkMarketContractByAddress(address: string): Contract {
		if (address.toLowerCase() === wallet1Address) {
			return cryptoPunks1
		}
		if (address.toLowerCase() === wallet2Address) {
			return cryptoPunks2
		}
		expectEqual(address.toLowerCase(), wallet3Address, "unknown address")
		return cryptoPunks3
	}

	/**
	 * Cancel native sell orders, if any. Ensure there are no native sell orders in the API response.
	 */
	async function cancelOrderInPunkMarket() {
		const forSale = await cryptoPunks1.methods.punksOfferedForSale(punkIndex).call()
		if (!forSale.isForSale) {
			printLog("No sell orders found in punk market")
			return
		}
		expectEqual(forSale.seller.toLowerCase(), wallet1, "punk is on sale by wallet1")
		printLog("Found sell order in punk market, cancelling it")
		await cryptoPunks1.methods.punkNoLongerForSale(punkIndex).send({from: wallet1Address})
		await checkApiNoMarketOrders()
	}

	/**
	 * Cancel native bids, if any. Ensure there are no native bids in the API response.
	 */
	async function cancelBidsInPunkMarket() {
		const bid = await cryptoPunks1.methods.punkBids(punkIndex).call()
		const bidder = bid.bidder.toString().toLowerCase()
		if (bidder === ZERO_ADDRESS.toLowerCase()) {
			printLog("No bids found in punk market")
			return
		}
		printLog(`Found bid in punk market from ${bidder}, cancelling it`)
		const contract = getPunkMarketContractByAddress(bidder)
		await contract.methods.withdrawBidForPunk(punkIndex).send({from: bidder})
		await checkApiNoMarketBids()
	}

	/**
	 * Ensure the API does not return any CRYPTO_PUNK sell orders.
	 */
	async function checkApiNoMarketOrders() {
		await runLogging(
			"ensure no punk market sell orders in API",
			retry(3, async () => {
				const orders = await getPunkMarketOrders()
				expectLength(orders, 0, "punk sell orders count")
			})
		)
	}

	/**
	 * Ensure the API does not return any CRYPTO_PUNK bids.
	 */
	async function checkApiNoMarketBids() {
		await runLogging(
			"ensure no punk market bids in API",
			retry(3, async () => {
				const bids = await getPunkMarketBids()
				expectLength(bids, 0, "punk bids count")
			})
		)
	}

	/**
	 * Ensure the API does not return any RARIBLE_V2 sell orders.
	 */
	async function checkApiNoRaribleOrders() {
		await runLogging(
			"ensure no rarible orders in API",
			retry(3, async () => {
				const bids = await getRariblePunkOrders()
				expectLength(bids, 0, "rarible sell orders count")
			})
		)
	}

	/**
	 * Ensure the API does not return any RARIBLE_V2 bids.
	 */
	async function checkApiNoRaribleBids() {
		await runLogging(
			"ensure no rarible bids in API",
			retry(3, async () => {
				const bids = await getRariblePunkBids()
				expectLength(bids, 0, "rarible bids count")
			})
		)
	}

	/**
	 * Request RaribleV2 sell orders from API.
	 */
	async function getRariblePunkOrders(): Promise<RaribleV2Order[]> {
		return await runLogging(
			"request RaribleV2 punk sell orders",
			getOrdersForPunkByType<RaribleV2Order>(ORDER_TYPE_RARIBLE_V2)
		)
	}

	/**
	 * Request CRYPTO_PUNK sell orders from API.
	 */
	async function getPunkMarketOrders(): Promise<CryptoPunkOrder[]> {
		return await runLogging(
			"request CRYPTO_PUNK sell orders",
			getOrdersForPunkByType<CryptoPunkOrder>(ORDER_TYPE_CRYPTO_PUNK)
		)
	}
	async function getOrdersForPunkByType<T extends Order>(type: String): Promise<T[]> {
		const orders = (await sdk1.apis.order.getSellOrdersByItem({
			contract: cryptoPunksAddress,
			tokenId: punkIndex.toString(),
			platform: Platform.ALL,
		})).orders
		return orders
			.filter(a => a["type"] === type)
			.map(o => o as T)
	}

	/**
	 * Request INACTIVE RaribleV2 sell orders from API.
	 */
	async function getInactiveRaribleOrders(): Promise<RaribleV2Order[]> {
		return await runLogging(
			"request INACTIVE RaribleV2 sell orders",
			getInactiveOrdersForPunkByType(ORDER_TYPE_RARIBLE_V2)
		)
	}
	/**
	 * Request INACTIVE CRYPTO_PUNK sell orders from API.
	 */
	async function getInactivePunkMarketOrders(): Promise<CryptoPunkOrder[]> {
		return await runLogging(
			"request INACTIVE RaribleV2 sell orders",
			getInactiveOrdersForPunkByType(ORDER_TYPE_CRYPTO_PUNK)
		)
	}

	/**
	 * @see getInactiveRaribleOrders
	 * @see getInactivePunkMarketOrders
	 */
	async function getInactiveOrdersForPunkByType<T extends Order>(type: String): Promise<T[]> {
		const orders = (await sdk1.apis.order.getSellOrdersByMakerAndByStatus({
			maker: wallet1Address,
			platform: Platform.ALL,
			status: [OrderStatus.INACTIVE],
		})).orders
		return orders
			.filter(a => a["type"] === type && ((a["make"]as Asset)["assetType"] as CryptoPunksAssetType)["tokenId"] === punkIndex)
			.map(o => o as T)
	}

	/**
	 * Request RaribleV2 bids from API.
	 */
	async function getRariblePunkBids(): Promise<RaribleV2Order[]> {
		return await runLogging(
			"request RaribleV2 punk bids from API",
			getBidsForPunkByType<RaribleV2Order>(ORDER_TYPE_RARIBLE_V2)
		)
	}

	/**
	 * Request CRYPTO_PUNK bids from API.
	 */
	async function getPunkMarketBids(): Promise<CryptoPunkOrder[]> {
		return await runLogging(
			"request CRYPTO_PUNK bids from API",
			getBidsForPunkByType<CryptoPunkOrder>(ORDER_TYPE_CRYPTO_PUNK)
		)
	}

	/**
	 * @see getRariblePunkBids
	 * @see getPunkMarketBids
	 */
	async function getBidsForPunkByType<T extends Order>(type: String): Promise<T[]> {
		const bids = (await sdk1.apis.order.getOrderBidsByItem({
			contract: cryptoPunksAddress,
			tokenId: punkIndex.toString(),
			platform: Platform.ALL,
		})).orders
		return bids
			.filter(a => a["type"] === type)
			.map(o => o as T)
	}

	/**
	 * Request INACTIVE CRYPTO_PUNK bids from API.
	 */
	async function getInactivePunkMarketBids(): Promise<CryptoPunkOrder[]> {
		return getInactiveBidsForPunkByType<CryptoPunkOrder>(ORDER_TYPE_CRYPTO_PUNK)
	}

	/**
	 * @see getInactivePunkMarketBids
	 */
	async function getInactiveBidsForPunkByType<T extends Order>(type: String): Promise<T[]> {
		const orders = (await sdk2.apis.order.getOrderBidsByMakerAndByStatus({
			maker: wallet2Address,
			platform: Platform.ALL,
			status: [OrderStatus.INACTIVE],
		})).orders
		return orders
			.filter(a => a["type"] === type && ((a["take"]as Asset)["assetType"] as CryptoPunksAssetType)["tokenId"] === punkIndex)
			.map(o => o as T)
	}

	function checkSellOrder(
		order: RaribleV2Order | CryptoPunkOrder,
		takeAssetType: EthAssetType | Erc20AssetType,
		price: number,
		taker: string | undefined = undefined
	) {
		expectEqual(order.make.assetType, ASSET_TYPE_CRYPTO_PUNK, "type of order.make.asset")
		expectEqual(order.make.value, "1", "order.make.value")
		expectEqual(order.makeStock, "1", "order.makeStock")
		expectEqual(order.maker, wallet1Address, "order.maker")

		expectEqual(order.taker, taker, "order.taker")
		expectEqual(order.take.assetType, takeAssetType, "type of order.take.asset")
	}

	function checkBid(
		bid: RaribleV2Order | CryptoPunkOrder,
		makeAssetType: EthAssetType | Erc20AssetType,
		price: number,
		taker: string | undefined = undefined
	) {
		expectEqual(bid.make.assetType, makeAssetType, "type of bid.make.asset")
		expectEqual(bid.maker, wallet2Address, "bid.maker")

		expectEqual(bid.taker, taker, "bid.taker")
		expectEqual(bid.take.assetType, ASSET_TYPE_CRYPTO_PUNK, "type of bid.take.asset")
		expectEqual(bid.take.valueDecimal, 1, "bid.take.valueDecimal")
	}

	async function runLogging<T extends any>(
		computationName: string,
		computation: Promise<T>
	): Promise<T> {
		try {
			printLog(`started '${computationName}'`)
			let result = await computation
			printLog(`finished '${computationName}'`)
			return result
		} catch (e) {
			printLog(`failed '${computationName}'`, e)
			throw e
		}
	}

	function printLog(message?: any, ...optionalParams: any[]) {
		let testName = expect.getState().currentTestName
		console.log(`--- ${testName} ---\n${message}`, optionalParams)
	}

})
