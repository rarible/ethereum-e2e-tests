import {createRaribleSdk} from "@rarible/protocol-ethereum-sdk"
import {toAddress} from "@rarible/types"
import {Web3Ethereum} from "@rarible/web3-ethereum"
import {Contract} from "web3-eth-contract"
import {RaribleV2Order} from "@rarible/ethereum-api-client"
import {Erc20AssetType} from "@rarible/ethereum-api-client/build/models"
import {awaitOwnershipValueToBe} from "./common/await-ownership-value-to-be"
import {awaitNoOwnership} from "./common/await-no-ownership"
import {initProvider} from "./common/init-providers"
import {verifyErc721Balance} from "./common/verify-erc721-balance"
import {verifyCryptoPunkOwner} from "./common/verify-crypto-punk-owner"
import {cryptoPunksAddress, cryptoPunksContract} from "./contracts/crypto-punks"
import {verifyEthBalance} from "./common/verify-eth-balance"
import {toBn} from "./common/to-bn"
import {retry} from "./common/retry"
import {expectEqual, expectLength} from "./common/expect-equal"
import {deployTestErc20, erc20Mint} from "./contracts/test-erc20"
import {verifyErc20Balance} from "./common/verify-erc20-balance"
import {
	ASSET_TYPE_CRYPTO_PUNK,
	ASSET_TYPE_ETH,
	punkIndex,
	ZERO_ADDRESS,
} from "./cryptoPunks/crypto-punks"
import {printLog, RETRY_ATTEMPTS, runLogging} from "./cryptoPunks/util"
import {
	cancelBidsInPunkMarket, checkApiNoMarketBids,
	createPunkMarketBid,
	getPunkMarketBids,
} from "./cryptoPunks/punk-market-bid"
import {
	cancelOrderInPunkMarket, createPunkMarketSellOrder,
	getInactivePunkMarketOrders,
	getPunkMarketOrders,
} from "./cryptoPunks/punk-market-sell"
import {
	cancelRaribleBids,
	checkApiRaribleBidExists,
	createRaribleBidOrder,
	getRariblePunkBids,
} from "./cryptoPunks/rarible-bid"
import {
	cancelRaribleOrders, checkApiNoRaribleOrders,
	createRaribleSellOrder,
	getInactiveRaribleOrders,
	getRariblePunkOrders,
} from "./cryptoPunks/rarible-sell"
import {checkSellOrder} from "./cryptoPunks/common-sell"
import {withdrawEth} from "./cryptoPunks/common-eth"
import {transferPunkBackToInitialOwner} from "./cryptoPunks/common-test"
import {fillOrder} from "./cryptoPunks/common-fill"

describe("crypto punks test", function () {

	const {web3: web31, wallet: wallet1} =
		initProvider("0x00120de4b1518cf1f16dc1b02f6b4a8ac29e870174cb1d8575f578480930250a")
	const {web3: web32, wallet: wallet2} =
		initProvider("0xa0d2baba419896add0b6e638ba4e50190f331db18e3271760b12ce87fa853dcb")
	const {web3: web33, wallet: wallet3} =
        initProvider("ded057615d97f0f1c751ea2795bc4b03bbf44844c13ab4f5e6fd976506c276b9")

	const sdk1 = createRaribleSdk(new Web3Ethereum({web3: web31}), "e2e")
	const wallet1Address = wallet1.getAddressString()

	const sdk2 = createRaribleSdk(new Web3Ethereum({web3: web32}), "e2e")
	const wallet2Address = wallet2.getAddressString()

	const wallet3Address = wallet3.getAddressString()
	const sdk3 = createRaribleSdk(new Web3Ethereum({web3: web33}), "e2e")

	const nftOwnershipApi = sdk1.apis.nftOwnership

	let cryptoPunks1: Contract
	let cryptoPunks2: Contract
	let cryptoPunks3: Contract

	let erc20: Contract
	let erc20Address: string
	let ASSET_TYPE_ERC20: Erc20AssetType
	const initErc20Balance = 100

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
		ASSET_TYPE_ERC20 = {
			assetClass: "ERC20",
			contract: toAddress(erc20Address),
		}

		await erc20Mint(erc20, wallet1Address, wallet2Address, initErc20Balance)
		await verifyErc20Balance(erc20, wallet2Address, initErc20Balance)

		await cleanupTestEnvironment()
		printLog("Finished test init")
	}, 30000)

	afterEach(async () => {
		await cleanupTestEnvironment()
	}, 30000)

	async function cleanupTestEnvironment() {
		printLog("Started cleaning up test environment")
		await transferPunkBackToInitialOwner(wallet1Address, wallet2Address, cryptoPunks2)

		await cancelBidsInPunkMarket(wallet1Address, cryptoPunks1, false)
		await cancelBidsInPunkMarket(wallet2Address, cryptoPunks2, false)
		await cancelBidsInPunkMarket(wallet3Address, cryptoPunks3, false)

		await cancelOrderInPunkMarket(wallet1Address, cryptoPunks1, false)
		await cancelOrderInPunkMarket(wallet2Address, cryptoPunks2, false)
		await cancelOrderInPunkMarket(wallet3Address, cryptoPunks3, false)

		await cancelRaribleBids(sdk1, wallet1Address)
		await cancelRaribleBids(sdk2, wallet2Address)
		await cancelRaribleBids(sdk3, wallet3Address)

		await cancelRaribleOrders(sdk1, wallet1Address)
		await cancelRaribleOrders(sdk2, wallet2Address)
		await cancelRaribleOrders(sdk3, wallet3Address)

		await verifyErc721Balance(cryptoPunks1, wallet1Address, 10)
		await verifyErc721Balance(cryptoPunks2, wallet2Address, 0)
		await verifyErc721Balance(cryptoPunks3, wallet3Address, 0)

		await verifyCryptoPunkOwner(cryptoPunks1, punkIndex, wallet1Address)

		await awaitOwnershipValueToBe(nftOwnershipApi, cryptoPunksAddress, punkIndex, wallet1Address, 1)
		await awaitNoOwnership(nftOwnershipApi, cryptoPunksAddress, punkIndex, wallet2Address)
		await awaitNoOwnership(nftOwnershipApi, cryptoPunksAddress, punkIndex, wallet3Address)

		await cryptoPunks1.methods.withdraw().send({from: wallet1Address})
		await cryptoPunks2.methods.withdraw().send({from: wallet2Address})
		await cryptoPunks3.methods.withdraw().send({from: wallet3Address})
		printLog("Finished cleaning up test environment")
	}

	test("check state before test", async () => {
	})

	test("test transfer", async () => {
		await sdk1.nft.transfer(ASSET_TYPE_CRYPTO_PUNK, toAddress(wallet2Address))
		await verifyCryptoPunkOwner(cryptoPunks2, punkIndex, wallet2Address)
		await awaitNoOwnership(nftOwnershipApi, cryptoPunksAddress, punkIndex, wallet1Address)
		await awaitOwnershipValueToBe(nftOwnershipApi, cryptoPunksAddress, punkIndex, wallet2Address, 1)
	}, 30000)

	test("test failed to transfer by not an owner", async () => {
		await expect(async () => {
			await sdk2.nft.transfer(
				ASSET_TYPE_CRYPTO_PUNK,
				toAddress(wallet1Address)
			)
		}).rejects.toThrowError("has not any ownerships of token with Id")
	})

	test("test transfer punk using punk market", async () => {
		await cryptoPunks1.methods.transferPunk(toAddress(wallet2Address), punkIndex).send({from: wallet1Address})
		await verifyCryptoPunkOwner(cryptoPunks2, punkIndex, wallet2Address)
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

		const balanceBefore1 = await web31.eth.getBalance(wallet1Address)
		const balanceBefore2 = await web32.eth.getBalance(wallet2Address)

		if (withExistingRaribleBid) {
			const raribleBid = 17
			await createRaribleBidOrder(wallet2Address, ASSET_TYPE_ETH, raribleBid, sdk2)
		}

		const punkBidPrice = 5
		if (withExistingPunkBid) {
			await createPunkMarketBid(wallet2Address, punkBidPrice, web32, cryptoPunks2)
		}

		const price = 7
		let sellOrder = await createRaribleSellOrder(wallet1Address, ASSET_TYPE_ETH, price, sdk1)

		await fillOrder(sellOrder, sdk2)
		await checkApiNoRaribleOrders()

		// Check balances.
		await verifyEthBalance(web31, toAddress(wallet1Address), toBn(balanceBefore1).plus(price).toString())
		if (withExistingPunkBid) {
			// Punk bid must be cancelled and ETH returned to the buyer.
			await withdrawEth(web32, cryptoPunks2, wallet2Address, punkBidPrice)

			// Punk market bid must be deleted (because the bidder got the punk via sale).
			await checkApiNoMarketBids(wallet2Address)
		}
		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(price).toString())

		if (withExistingRaribleBid) {
			// The Rarible bid must survive.
			await checkApiRaribleBidExists(wallet2Address)
		}

		await verifyCryptoPunkOwner(cryptoPunks2, punkIndex, wallet2Address)
		await awaitNoOwnership(nftOwnershipApi, cryptoPunksAddress, punkIndex, wallet1Address)
		await awaitOwnershipValueToBe(nftOwnershipApi, cryptoPunksAddress, punkIndex, wallet2Address, 1)
	}

	test("test sell for erc20 by rarible order", async () => {
		const price = 24
		let order: RaribleV2Order = await createRaribleSellOrder(wallet1Address, ASSET_TYPE_ERC20, price, sdk1)
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
			await createRaribleBidOrder(wallet2Address, ASSET_TYPE_ERC20, price, sdk1)
			await retry(RETRY_ATTEMPTS, async () => {
				const bids = await getRariblePunkBids(wallet2Address)
				expectEqual(bids.length, 1, "rarible bids count")
			})
		}
		if (withExistingPunkBid) {
			const bidPrice = 5
			await cryptoPunks2.methods.enterBidForPunk(punkIndex).send({from: wallet2Address, value: bidPrice})
			await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(bidPrice).toString())
			await retry(RETRY_ATTEMPTS, async () => {
				const cryptoPunkBids = await getPunkMarketBids(wallet2Address)
				expectLength(cryptoPunkBids, 1, "punk bids before buying")
			})
		}
		const minPrice = 8
		const order = await createPunkMarketSellOrder(wallet1Address, minPrice, cryptoPunks1)

		await runLogging(
			"fill order",
			sdk2.order.fill({
				order,
				amount: 1,
				infinite: true,
			})
		)
		await retry(RETRY_ATTEMPTS, async () => {
			const orders = await getPunkMarketOrders(wallet1Address)
			expectLength(orders, 0, "punk order after sale")
		})
		if (withExistingRaribleBid) {
			// there is an active bid of wallet2 - of current owner of punk. it's ok
			await retry(RETRY_ATTEMPTS, async () => {
				const bids = await getRariblePunkBids(wallet2Address)
				expectLength(bids, 1, "rarible bids count after buying")
			})
		}
		if (withExistingPunkBid) {
			// bid is deleted (it was deleted by punk market)
			await cryptoPunks2.methods.withdraw().send({from: wallet2Address})
			await retry(RETRY_ATTEMPTS, async () => {
				const cryptoPunkBids = await getPunkMarketBids(wallet2Address)
				expectLength(cryptoPunkBids, 0, "punk bids after buying")
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
		const order = await retry(RETRY_ATTEMPTS, async () => {
			const orders = await getPunkMarketOrders(wallet1Address)
			expectLength(orders, 1, "punk orders count")
			return orders[0]
		})
		printLog(`order: ${JSON.stringify(order)}`)
		checkSellOrder(order, {assetClass: "ETH"}, minPrice, wallet2Address)
		const balanceBefore = await web32.eth.getBalance(wallet2Address)
		await runLogging(
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
		await createRaribleSellOrder(wallet1Address, ASSET_TYPE_ETH, price, sdk1)

		// create punk order
		const minPrice = 8
		await createPunkMarketSellOrder(wallet1Address, minPrice, cryptoPunks1)
		await cryptoPunks1.methods.offerPunkForSale(punkIndex, minPrice).send({from: wallet1Address})
		// expected: 1 punk order, no one rarible order

		// todo error
		// rarible order must be deleted, because there is no Offer(price: 0, onlySellTo: proxy) anymore
		// whereas rarible order needs such offer for executing
		await retry(RETRY_ATTEMPTS, async () => {
			const orders = await getRariblePunkOrders(wallet1Address)
			expectLength(orders, 0, "rarible orders count after creating punk order")
		})
		// // рарибл ордер должен был быть удален
		// // это подтверждение, что он нерабочий.
		// // (так как для его выполнения должен быть ордер в панко-контракте с onlySellTo=proxy и др. полями,
		// // а мы этот ордер перетерли нативным панко-ордером)
		// const raribleOrder = await retry(RETRY_ATTEMPTS, async () => {
		// 	const orders = await getRariblePunkOrders(sdk1, wallet1Address)
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
		let punkOrder = await retry(RETRY_ATTEMPTS, async () => {
			const orders = await getPunkMarketOrders(wallet1Address)
			expectLength(orders, 1, "punk orders count")
			return orders[0]
		})
		printLog(`punk order: ${JSON.stringify(punkOrder)}`)
		checkSellOrder(punkOrder, ASSET_TYPE_ETH, minPrice, wallet1Address)
		// create rarible order
		const price = 7
		await createRaribleSellOrder(wallet1Address, ASSET_TYPE_ETH, price, sdk1)

		const forSaleForProxy = await cryptoPunks1.methods.punksOfferedForSale(punkIndex).call()
		expectEqual(forSaleForProxy.minValue, "0", "for proxy offer.minValue")
		expectEqual(forSaleForProxy.onlySellTo !== ZERO_ADDRESS, true, "for proxy only sell to must be filled")
		// todo error
		// punk order must be deleted, because there is Offer(price: 0, onlySellTo: proxy) for proxy
		// thus punk order isn't executable anymore
		await retry(RETRY_ATTEMPTS, async () => {
			const orders = await getPunkMarketOrders(wallet1Address)
			expectLength(orders, 0, "punk orders count after rarible order is created")
		})
		// // punk должен был быть удален
		// // это подтверждение, что он нерабочий
		// const cryptoPunkOrder = await retry(RETRY_ATTEMPTS, async () => {
		// 	const orders = await getPunkMarketOrders(sdk1, wallet1Address)
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
		let order = await createRaribleSellOrder(wallet1Address, ASSET_TYPE_ERC20, price, sdk1)
		await sdk1.order.cancel(order)
		await retry(RETRY_ATTEMPTS, async () => {
			const orders = await getRariblePunkOrders(wallet1Address)
			expectLength(orders, 0, "orders count from api after cancel")
		})
	}, 30000)

	test("test cancel sell by punk market", async () => {
		const minPrice = 8
		await cryptoPunks1.methods.offerPunkForSale(punkIndex, minPrice).send({from: wallet1Address})
		const forSaleTrue = await cryptoPunks1.methods.punksOfferedForSale(punkIndex).call()
		printLog(`forSale: ${JSON.stringify(forSaleTrue)}`)
		expectEqual(forSaleTrue.isForSale, true, "cryptoPunk offer.isForSale")
		await retry(RETRY_ATTEMPTS, async () => {
			const orders = await getPunkMarketOrders(wallet1Address)
			expectLength(orders, 1, "punk orders count")
		})
		await cryptoPunks1.methods.punkNoLongerForSale(punkIndex).send({from: wallet1Address})
		const forSale = await cryptoPunks1.methods.punksOfferedForSale(punkIndex).call()
		printLog(`cancelled forSale: ${JSON.stringify(forSale)}`)
		expectEqual(forSale.isForSale, false, "cryptoPunk cancelled offer.isForSale")
		await retry(RETRY_ATTEMPTS, async () => {
			const orders = await getPunkMarketOrders(wallet1Address)
			expectLength(orders, 0, "punk orders count from api")
		})
	}, 30000)

	test("test cancel sell order by punk market using api", async () => {
		const minPrice = 8
		await createPunkMarketSellOrder(wallet1Address, minPrice, cryptoPunks1)
		await cancelOrderInPunkMarket(wallet1Address, cryptoPunks1)
	}, 30000)

	test("test update sell by punk market using api", async () => {
		const minPrice = 8
		await cryptoPunks1.methods.offerPunkForSale(punkIndex, minPrice).send({from: wallet1Address})
		const forSale = await cryptoPunks1.methods.punksOfferedForSale(punkIndex).call()
		printLog(`forSale: ${JSON.stringify(forSale)}`)
		expectEqual(forSale.isForSale, true, "cryptoPunk offer.isForSale")
		expectEqual(forSale.minValue, minPrice.toString(), "cryptoPunk offer.minValue")
		const order = await retry(RETRY_ATTEMPTS, async () => {
			const orders = await getPunkMarketOrders(wallet1Address)
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
		await retry(RETRY_ATTEMPTS, async () => {
			const orders = await getRariblePunkOrders(wallet1Address)
			expectLength(orders, 1, "rarible orders count after update")
			const order = orders[0]
			expectEqual(order.take.value, newMinPrice.toString(), "updated sell order: take.value")
		})
		//todo ошибка: предыдущего панк-ордера не должно быть
		await retry(RETRY_ATTEMPTS, async () => {
			const orders = await getPunkMarketOrders(wallet1Address)
			expectLength(orders, 0, "punk orders count after update")
		})
	}, 30000)

	test("test punk order and transfer", async () => {
		await cryptoPunks1.methods.offerPunkForSale(punkIndex, 8).send({from: wallet1Address})
		const forSale = await cryptoPunks1.methods.punksOfferedForSale(punkIndex).call()
		expectEqual(forSale.isForSale, true, "cryptoPunk offer.isForSale")
		await retry(RETRY_ATTEMPTS, async () => {
			const orders = await getPunkMarketOrders(wallet1Address)
			expectLength(orders, 1, "punk orders count")
		})
		await sdk1.nft.transfer(ASSET_TYPE_CRYPTO_PUNK, toAddress(wallet2Address))
		const forSaleCancelled = await cryptoPunks1.methods.punksOfferedForSale(punkIndex).call()
		expectEqual(forSaleCancelled.isForSale, false, "cryptoPunk offer.isForSale after transfer")
		// punk order is deleted
		await retry(RETRY_ATTEMPTS, async () => {
			const orders = await getPunkMarketOrders(wallet1Address)
			expectLength(orders, 0, "punk orders count after transfer")
		})
		await retry(RETRY_ATTEMPTS, async () => {
			const orders = await getInactivePunkMarketOrders(wallet1Address)
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
		await retry(RETRY_ATTEMPTS, async () => {
			const bids = await getPunkMarketBids(wallet2Address)
			expectLength(bids, 1, "punk bids count")
		})
		await cryptoPunks2.methods.withdrawBidForPunk(punkIndex).send({from: wallet2Address})
		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).toString())
		const cryptoPunkCancelledBid = await cryptoPunks2.methods.punkBids(punkIndex).call()
		expectEqual(cryptoPunkCancelledBid.hasBid, false, "cancelled bid.hasBid")
		await retry(RETRY_ATTEMPTS, async () => {
			const bids = await getPunkMarketBids(wallet2Address)
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
		const bid = await retry(RETRY_ATTEMPTS, async () => {
			const bids = await getPunkMarketBids(wallet2Address)
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
		await retry(RETRY_ATTEMPTS, async () => {
			const cryptoPunkBids = await getPunkMarketBids(wallet2Address)
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
		await retry(RETRY_ATTEMPTS, async () => {
			const bids = await getPunkMarketBids(wallet2Address)
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
		await retry(RETRY_ATTEMPTS, async () => {
			const bids = await getPunkMarketBids(wallet2Address)
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
		const bid = await retry(RETRY_ATTEMPTS, async () => {
			const bids = await getPunkMarketBids(wallet2Address)
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
		await retry(RETRY_ATTEMPTS, async () => {
			const bids = await getRariblePunkBids(wallet2Address)
			expectLength(bids, 1, "rarible bids count after update")
			const bid = bids[0]
			expectEqual(bid.make.value, newPrice.toString(), "updated bid: make.value")
		})
		await retry(RETRY_ATTEMPTS, async () => {
			const bids = await getPunkMarketBids(wallet2Address)
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
		await retry(RETRY_ATTEMPTS, async () => {
			const bids = await getPunkMarketBids(wallet2Address)
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
		await retry(RETRY_ATTEMPTS, async () => {
			const bids = await getPunkMarketBids(wallet2Address)
			expectLength(bids, 1, "punk bids count after new bid")
		})
		await retry(RETRY_ATTEMPTS, async () => {
			const bids = await getInactivePunkMarketOrders(wallet1Address)
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
		await retry(RETRY_ATTEMPTS, async () => {
			const bids = await getPunkMarketBids(wallet2Address)
			expectLength(bids, 1, "punk bids count")
		})
		await sdk1.nft.transfer(ASSET_TYPE_CRYPTO_PUNK, toAddress(wallet2Address))
		const cryptoPunkCancelledBid = await cryptoPunks2.methods.punkBids(punkIndex).call()
		expectEqual(cryptoPunkCancelledBid.hasBid, false, "punk bid.hasBid after transferring")
		// todo ошибка: punk бид д б удален, т к в контракте нет его соответствия.
		//  его невозможно ни реализовать ни отменить. стейт патовый
		//  чинится только созданием заново панк-бида и потом уже отменой (cancelBrokenPunkBid)
		// punk bid is deleted
		await retry(RETRY_ATTEMPTS, async () => {
			const bids = await getPunkMarketBids(wallet2Address)
			expectLength(bids, 0, "punk bids count after transfer")
		})
	}, 30000)

	test("test punk bid and rarible bid creation", async () => {
		await cryptoPunks2.methods.enterBidForPunk(punkIndex).send({from: wallet2Address, value: 8})
		const cryptoPunkBid = await cryptoPunks2.methods.punkBids(punkIndex).call()
		expectEqual(cryptoPunkBid.hasBid, true, "cryptoPunkBid.hasBid")
		const price = 10
		await createRaribleBidOrder(wallet2Address, ASSET_TYPE_ERC20, price, sdk1)
		await retry(RETRY_ATTEMPTS, async () => {
			const bids = await getPunkMarketBids(wallet2Address)
			expectLength(bids, 1, "punk bids count")
		})
		await retry(RETRY_ATTEMPTS, async () => {
			const bids = await getRariblePunkBids(wallet2Address)
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
			await createRaribleSellOrder(wallet1Address, ASSET_TYPE_ETH, price, sdk1)
		}
		if (withExistingPunkOrder) {
			const minPrice = 28
			await cryptoPunks1.methods.offerPunkForSale(punkIndex, minPrice).send({from: wallet1Address})
			await retry(RETRY_ATTEMPTS, async () => {
				const orders = await getPunkMarketOrders(wallet1Address)
				expectLength(orders, 1, "punk order before bid")
			})
		}
		const price = 24
		const createdBid: RaribleV2Order = await createRaribleBidOrder(wallet2Address, ASSET_TYPE_ERC20, price, sdk1)
		let bid = await retry(RETRY_ATTEMPTS, async () => {
			const bids = await getRariblePunkBids(wallet2Address)
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
			await retry(RETRY_ATTEMPTS, async () => {
				const orders = await getRariblePunkOrders(wallet1Address)
				expectLength(orders, 0, "rarible order after accepting bid")
			})
			// todo error: при accept bid sell-ордер стал со статусом inactive. т е после возвращения панка владельцу
			// ордера он опять активный, хотя нереализуем
			// (т к при accept bid идет transfer и записывается Offer(isForSale=false))
			await retry(RETRY_ATTEMPTS, async () => {
				const orders = await getInactiveRaribleOrders(wallet1Address)
				expectLength(orders, 0, "inactive rarible order after accepting bid")
			})
			// transfer punk back and check that there is still no rarible order
			await transferPunkBackToInitialOwner(wallet1Address, wallet2Address, cryptoPunks2)
			await retry(RETRY_ATTEMPTS, async () => {
				const orders = await getRariblePunkOrders(wallet1Address)
				expectLength(orders, 0, "rarible orders count after accepting bid")
			})
			// // это подтверждение, что ордер нереализуем (панк д б у wallet1)
			// const order = await retry(RETRY_ATTEMPTS, async () => {
			// 	const orders = await getRariblePunkOrders(sdk1, wallet1Address)
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
			await retry(RETRY_ATTEMPTS, async () => {
				const orders = await getPunkMarketOrders(wallet1Address)
				expectLength(orders, 0, "punk order after accepting bid")
			})
			// todo error: при accept bid sell-ордер стал со статусом inactive. т е после возвращения панка владельцу
			// ордера он опять активный, хотя нереализуем
			// (т к при accept bid идет transfer и записывается Offer(isForSale=false))
			await retry(RETRY_ATTEMPTS, async () => {
				const orders = await getInactivePunkMarketOrders(wallet1Address)
				expectLength(orders, 0, "inactive punk order after accepting bid")
			})
			// transfer punk back and check that there is still no punk order
			await transferPunkBackToInitialOwner(wallet1Address, wallet2Address, cryptoPunks2)
			// todo тут тоже ошибка. он inactive, значит при получении панка назад ордер д б active,
			//  но он все равно inactive
			await retry(RETRY_ATTEMPTS, async () => {
				const orders = await getPunkMarketOrders(wallet1Address)
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
			await createRaribleSellOrder(wallet1Address, ASSET_TYPE_ETH, price, sdk1)
		}
		if (withExistingPunkOrder) {
			const minPrice = 28
			await cryptoPunks1.methods.offerPunkForSale(punkIndex, minPrice).send({from: wallet1Address})
			await retry(RETRY_ATTEMPTS, async () => {
				const orders = await getPunkMarketOrders(wallet1Address)
				expectLength(orders, 1, "punk order before bid")
			})
		}
		const price = 5
		const punkMarketBid = await createPunkMarketBid(wallet2Address, price, web32, cryptoPunks2)
		await runLogging(
			"fill order",
			sdk1.order.fill({
				order: punkMarketBid,
				amount: 1,
				infinite: true,
			})
		)
		await checkApiNoMarketBids(wallet2Address)

		await withdrawEth(web31, cryptoPunks1, wallet1Address, price)

		await verifyCryptoPunkOwner(cryptoPunks2, punkIndex, wallet2Address)
		await awaitNoOwnership(nftOwnershipApi, cryptoPunksAddress, punkIndex, wallet1Address)
		await awaitOwnershipValueToBe(nftOwnershipApi, cryptoPunksAddress, punkIndex, wallet2Address, 1)

		if (withExistingRaribleOrder) {
			await retry(RETRY_ATTEMPTS, async () => {
				const orders = await getRariblePunkOrders(wallet1Address)
				expectLength(orders, 0, "rarible order after accepting bid")
			})
			// todo error: при accept bid sell-ордер стал со статусом inactive. т е после возвращения панка владельцу
			// ордера он опять активный, хотя нереализуем (т к при accept bid записывается Offer(isForSale=false)
			await retry(RETRY_ATTEMPTS, async () => {
				const orders = await getInactiveRaribleOrders(wallet1Address)
				expectLength(orders, 0, "inactive rarible order after accepting bid")
			})
			// transfer punk back and check that there is still no rarible order
			await transferPunkBackToInitialOwner(wallet1Address, wallet2Address, cryptoPunks2)
			await retry(RETRY_ATTEMPTS, async () => {
				const orders = await getRariblePunkOrders(wallet1Address)
				expectLength(orders, 0, "rarible orders count after accepting bid")
			})
			// // это подтверждение, что ордер нереализуем
			// const order = await retry(RETRY_ATTEMPTS, async () => {
			// 	const orders = await getRariblePunkOrders(sdk1, wallet1Address)
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
			await retry(RETRY_ATTEMPTS, async () => {
				const orders = await getPunkMarketOrders(wallet1Address)
				expectLength(orders, 0, "punk order after accepting bid")
			})
			// todo error: при accept bid sell-ордер стал со статусом inactive. т е после возвращения панка владельцу
			// ордера он опять активный, хотя нереализуем (т к при accept bid записывается Offer(isForSale=false)
			await retry(RETRY_ATTEMPTS, async () => {
				const orders = await getInactivePunkMarketOrders(wallet1Address)
				expectLength(orders, 0, "inactive punk order after accepting bid")
			})
			// transfer punk back and check that there is still no punk order
			await transferPunkBackToInitialOwner(wallet1Address, wallet2Address, cryptoPunks2)
			// todo тут тоже ошибка. он inactive, значит при получении панка назад ордер д б active,
			//  но он все равно inactive
			await retry(RETRY_ATTEMPTS, async () => {
				const orders = await getPunkMarketOrders(wallet1Address)
				expectLength(orders, 1, "punk orders count after transferring back")
			})
		}
	}
})
