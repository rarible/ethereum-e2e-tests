import {createRaribleSdk} from "@rarible/protocol-ethereum-sdk"
import {toAddress} from "@rarible/types"
import {Web3Ethereum} from "@rarible/web3-ethereum"
import {Contract} from "web3-eth-contract"
import {Erc20AssetType} from "@rarible/ethereum-api-client/build/models"
import {e2eConfig} from "@rarible/protocol-ethereum-sdk/build/config/e2e"
import {awaitOwnershipValueToBe} from "./common/await-ownership-value-to-be"
import {awaitNoOwnership} from "./common/await-no-ownership"
import {initProvider} from "./common/init-providers"
import {verifyErc721Balance} from "./common/verify-erc721-balance"
import {verifyCryptoPunkOwner} from "./common/verify-crypto-punk-owner"
import {cryptoPunksAddress, cryptoPunksContract} from "./contracts/crypto-punks"
import {verifyEthBalance} from "./common/verify-eth-balance"
import {toBn} from "./common/to-bn"
import {retry} from "./common/retry"
import {expectEqual} from "./common/expect-equal"
import {deployTestErc20, erc20Mint} from "./contracts/test-erc20"
import {verifyErc20Balance} from "./common/verify-erc20-balance"
import {ASSET_TYPE_CRYPTO_PUNK, ASSET_TYPE_ETH, punkIndex} from "./cryptoPunks/crypto-punks"
import {printLog, RETRY_ATTEMPTS, runLogging, TEST_TIMEOUT} from "./cryptoPunks/util"
import {
	cancelBidsInPunkMarket,
	checkApiNoMarketBids,
	checkApiPunkMarketBidExists,
	checkPunkMarketBidExists,
	checkPunkMarketBidNotExists,
	createPunkMarketBid,
} from "./cryptoPunks/punk-market-bid"
import {
	cancelSellOrderInPunkMarket,
	checkApiNoMarketSellOrders,
	checkApiPunkMarketSellOrderExists,
	checkPunkMarketForSale,
	checkPunkMarketNotForSale,
	createPunkMarketSellOrder,
} from "./cryptoPunks/punk-market-sell"
import {cancelRaribleBids, checkApiRaribleBidExists, createRaribleBidOrder} from "./cryptoPunks/rarible-bid"
import {
	cancelRaribleSellOrders,
	checkApiNoRaribleSellOrders,
	checkApiRaribleSellOrderExists,
	createRaribleSellOrder,
} from "./cryptoPunks/rarible-sell"
import {withdrawEth} from "./cryptoPunks/common-eth"
import {transferPunkTo} from "./cryptoPunks/punk-transfer"
import {fillOrder} from "./cryptoPunks/common-fill"
import {checkApiNoRaribleBids} from "./cryptoPunks/common-bid"

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
	}, TEST_TIMEOUT)

	afterEach(async () => {
		// await cleanupTestEnvironment()
	}, TEST_TIMEOUT)

	async function cleanupTestEnvironment() {
		printLog("Started cleaning up test environment")
		await transferPunkTo(wallet1Address, wallet2Address, cryptoPunks2)
		await transferPunkTo(wallet1Address, wallet3Address, cryptoPunks3)

		await cancelBidsInPunkMarket(wallet1Address, cryptoPunks1)
		await cancelBidsInPunkMarket(wallet2Address, cryptoPunks2)
		await cancelBidsInPunkMarket(wallet3Address, cryptoPunks3)
		await checkApiNoMarketBids()

		await cancelSellOrderInPunkMarket(wallet1Address, cryptoPunks1, false)
		await cancelSellOrderInPunkMarket(wallet2Address, cryptoPunks2, false)
		await cancelSellOrderInPunkMarket(wallet3Address, cryptoPunks3, false)
		await checkApiNoMarketSellOrders()

		await cancelRaribleBids(sdk1, wallet1Address)
		await cancelRaribleBids(sdk2, wallet2Address)
		await cancelRaribleBids(sdk3, wallet3Address)
		await checkApiNoRaribleBids()

		await cancelRaribleSellOrders(sdk1, wallet1Address)
		await cancelRaribleSellOrders(sdk2, wallet2Address)
		await cancelRaribleSellOrders(sdk3, wallet3Address)

		await verifyErc721Balance(cryptoPunks1, wallet1Address, 10)
		await verifyErc721Balance(cryptoPunks2, wallet2Address, 0)
		await verifyErc721Balance(cryptoPunks3, wallet3Address, 0)

		await verifyCryptoPunkOwner(cryptoPunks1, punkIndex, wallet1Address)

		await awaitOwnershipValueToBe(cryptoPunksAddress, punkIndex, wallet1Address, 1)
		await awaitNoOwnership(cryptoPunksAddress, punkIndex, wallet2Address)
		await awaitNoOwnership(cryptoPunksAddress, punkIndex, wallet3Address)

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
		await awaitNoOwnership(cryptoPunksAddress, punkIndex, wallet1Address)
		await awaitOwnershipValueToBe(cryptoPunksAddress, punkIndex, wallet2Address, 1)
	}, TEST_TIMEOUT)

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
		await awaitNoOwnership(cryptoPunksAddress, punkIndex, wallet1Address)
		await awaitOwnershipValueToBe(cryptoPunksAddress, punkIndex, wallet2Address, 1)
	}, TEST_TIMEOUT)

	test("test sell for eth by rarible order", async () => {
		await sellForEthByRaribleOrder(false)
	}, TEST_TIMEOUT)

	test("test sell for eth by rarible order with existing rarible bid", async () => {
		await sellForEthByRaribleOrder(true, false)
	}, TEST_TIMEOUT)

	test("test sell for eth by rarible order with existing punk bid", async () => {
		await sellForEthByRaribleOrder(false, true)
	}, TEST_TIMEOUT)

	async function sellForEthByRaribleOrder(
		withExistingRaribleBid: boolean,
		withExistingPunkBid: boolean = false
	) {
		if (withExistingRaribleBid && withExistingPunkBid) {
			throw new Error("check supports case with either rarible or punk bid")
		}

		const balanceBefore1 = await web31.eth.getBalance(wallet1Address)
		const balanceBefore2 = await web32.eth.getBalance(wallet2Address)

		const raribleBidPrice = 17
		if (withExistingRaribleBid) {
			await createRaribleBidOrder(wallet2Address, ASSET_TYPE_ERC20, raribleBidPrice, sdk2)
		}

		const punkBidPrice = 5
		if (withExistingPunkBid) {
			await createPunkMarketBid(wallet2Address, punkBidPrice, web32, cryptoPunks2)
		}

		const price = 7
		let sellOrder = await createRaribleSellOrder(wallet1Address, ASSET_TYPE_ETH, price, sdk1)

		await fillOrder(sellOrder, sdk2)
		await checkApiNoRaribleSellOrders()

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
			await checkApiRaribleBidExists(wallet2Address, raribleBidPrice)
		}

		await verifyCryptoPunkOwner(cryptoPunks2, punkIndex, wallet2Address)
		await awaitNoOwnership(cryptoPunksAddress, punkIndex, wallet1Address)
		await awaitOwnershipValueToBe(cryptoPunksAddress, punkIndex, wallet2Address, 1)
	}

	test("test sell for erc20 by rarible order", async () => {
		const price = 24
		let sellOrder = await createRaribleSellOrder(wallet1Address, ASSET_TYPE_ERC20, price, sdk1)
		await fillOrder(sellOrder, sdk2)
		await verifyErc20Balance(erc20, wallet1Address, price)
		await verifyErc20Balance(erc20, wallet2Address, initErc20Balance - price)
		await verifyCryptoPunkOwner(cryptoPunks1, punkIndex, wallet2Address)
		await awaitNoOwnership(cryptoPunksAddress, punkIndex, wallet1Address)
		await awaitOwnershipValueToBe(cryptoPunksAddress, punkIndex, wallet2Address, 1)
	}, TEST_TIMEOUT)

	test("test sell by punk market", async () => {
		await sellByPunkMarket(false)
	}, TEST_TIMEOUT)

	test("test sell by punk market with existing rarible bid", async () => {
		await sellByPunkMarket(true)
	}, TEST_TIMEOUT)

	test("test sell by punk market with existing punk bid", async () => {
		await sellByPunkMarket(false, true)
	}, TEST_TIMEOUT)

	async function sellByPunkMarket(
		withExistingRaribleBid: boolean,
		withExistingPunkBid: boolean = false
	) {
		if (withExistingRaribleBid && withExistingPunkBid) {
			throw new Error("check supports case with either rarible or punk bid")
		}
		const balanceBefore2 = await web32.eth.getBalance(wallet2Address)
		const raribleBidPrice = 17
		if (withExistingRaribleBid) {
			await createRaribleBidOrder(wallet2Address, ASSET_TYPE_ERC20, raribleBidPrice, sdk2)
		}
		const punkMarketBidPrice = 5
		if (withExistingPunkBid) {
			await createPunkMarketBid(wallet2Address, punkMarketBidPrice, web32, cryptoPunks2)
		}
		const sellPrice = 8
		const sellOrder = await createPunkMarketSellOrder(wallet1Address, sellPrice, cryptoPunks1)

		await fillOrder(sellOrder, sdk2)
		await checkApiNoMarketSellOrders()
		if (withExistingRaribleBid) {
			// Rarible bid must survive
			await checkApiRaribleBidExists(wallet2Address, raribleBidPrice)
		}
		if (withExistingPunkBid) {
			// Punk market bid must be cancelled (because the bidder got the punk he wanted).
			await withdrawEth(web32, cryptoPunks2, wallet2Address, punkMarketBidPrice)
			await checkPunkMarketBidNotExists(cryptoPunks2)
			await checkApiNoMarketBids(wallet2Address)
		}
		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(sellPrice).toString())
		await verifyCryptoPunkOwner(cryptoPunks2, punkIndex, wallet2Address)
		await awaitNoOwnership(cryptoPunksAddress, punkIndex, wallet1Address)
		await awaitOwnershipValueToBe(cryptoPunksAddress, punkIndex, wallet2Address, 1)
	}

	test("test sell to specific address by punk market", async () => {
		const price = 7
		const sellOrder = await createPunkMarketSellOrder(wallet1Address, price, cryptoPunks1, wallet2Address)
		const balanceBefore2 = await web32.eth.getBalance(wallet2Address)
		await fillOrder(sellOrder, sdk2)
		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(price).toString())
		await verifyCryptoPunkOwner(cryptoPunks1, punkIndex, wallet2Address)
		await awaitNoOwnership(cryptoPunksAddress, punkIndex, wallet1Address)
		await awaitOwnershipValueToBe(cryptoPunksAddress, punkIndex, wallet2Address, 1)
	}, TEST_TIMEOUT)

	test("test cancel rarible order because punk market sell order is created", async () => {
		const rariblePrice = 7
		await createRaribleSellOrder(wallet1Address, ASSET_TYPE_ETH, rariblePrice, sdk1)

		const punkMarketPrice = 8
		await createPunkMarketSellOrder(wallet1Address, punkMarketPrice, cryptoPunks1)

		// Rarible sell order must be deleted because the approval for Rarible order is removed.
		await checkApiNoRaribleSellOrders()
	}, TEST_TIMEOUT)


	test("test replace punk market sell order with rarible sell order approval", async () => {
		const punkMarketPrice = 8
		await createPunkMarketSellOrder(wallet1Address, punkMarketPrice, cryptoPunks1)

		const rariblePrice = 7
		await createRaribleSellOrder(wallet1Address, ASSET_TYPE_ETH, rariblePrice, sdk1)

		await checkPunkMarketForSale(
			cryptoPunks1,
			wallet1Address,
			0,
			e2eConfig.transferProxies.cryptoPunks.toLowerCase()
		)

		await checkApiRaribleSellOrderExists(wallet1Address, rariblePrice)
		await checkApiNoMarketSellOrders()
	}, TEST_TIMEOUT)

	test("test cancel rarible sell order", async () => {
		const price = 24
		let order = await createRaribleSellOrder(wallet1Address, ASSET_TYPE_ERC20, price, sdk1)
		await checkPunkMarketForSale(
			cryptoPunks1,
			wallet1Address,
			0,
			e2eConfig.transferProxies.cryptoPunks.toLowerCase()
		)
		await sdk1.order.cancel(order)
		await checkApiNoRaribleSellOrders()
		// Punk market sell order approval still exists.
		await checkPunkMarketForSale(
			cryptoPunks1,
			wallet1Address,
			0,
			e2eConfig.transferProxies.cryptoPunks.toLowerCase()
		)
	}, TEST_TIMEOUT)

	test("test cancel sell order by punk market", async () => {
		const price = 8
		await createPunkMarketSellOrder(wallet1Address, price, cryptoPunks1)
		await cancelSellOrderInPunkMarket(wallet1Address, cryptoPunks1, true)
		await checkApiNoMarketSellOrders()
	}, TEST_TIMEOUT)

	test("test update sell order by punk market using api", async () => {
		const price = 8
		const sellOrder = await createPunkMarketSellOrder(wallet1Address, price, cryptoPunks1)

		const newPrice = 10
		await runLogging(
			`update sell order ${sellOrder}`,
			sdk1.order.sellUpdate({
				order: sellOrder,
				price: newPrice,
			})
		)
		await checkPunkMarketForSale(cryptoPunks1, wallet1Address, newPrice)
		await retry(RETRY_ATTEMPTS, async () => {
			let updatedSellOrder = await checkApiPunkMarketSellOrderExists(wallet1Address)
			expectEqual(updatedSellOrder.take.value, newPrice.toString(), "updated sell price")
		})
	}, TEST_TIMEOUT)

	test("test punk market sell order and transfer for free", async () => {
		await createPunkMarketSellOrder(wallet1Address, 8, cryptoPunks1)
		await sdk1.nft.transfer(ASSET_TYPE_CRYPTO_PUNK, toAddress(wallet2Address))
		await checkPunkMarketNotForSale(cryptoPunks1)
		await checkApiNoMarketSellOrders()
	}, TEST_TIMEOUT)

	test("test cancel bid by punk market", async () => {
		const price = 8
		const balanceBefore2 = await web32.eth.getBalance(wallet2Address)
		await createPunkMarketBid(wallet2Address, price, web32, cryptoPunks2)
		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(price).toString())
		await cryptoPunks2.methods.withdrawBidForPunk(punkIndex).send({from: wallet2Address})
		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).toString())
		await checkPunkMarketBidNotExists(cryptoPunks2)
		await checkApiNoMarketBids(wallet2Address)
	}, TEST_TIMEOUT)

	test("test cancel bid by punk market using api", async () => {
		const price = 8
		const balanceBefore2 = await web32.eth.getBalance(wallet2Address)
		const bid = await createPunkMarketBid(wallet2Address, price, web32, cryptoPunks2)
		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(price).toString())
		await runLogging(
			`cancel bid ${bid}`,
			sdk2.order.cancel(bid)
		)
		await checkPunkMarketBidNotExists(cryptoPunks2)
		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).toString())
		await checkApiNoMarketBids(wallet2Address)
	}, TEST_TIMEOUT)

	test("test update bid by punk market", async () => {
		const oldPrice = 8
		const balanceBefore2 = await web32.eth.getBalance(wallet2Address)
		await createPunkMarketBid(wallet2Address, oldPrice, web32, cryptoPunks2)
		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(oldPrice).toString())

		const newPrice = 10
		await createPunkMarketBid(wallet2Address, newPrice, web32, cryptoPunks2)
		await withdrawEth(web32, cryptoPunks2, wallet2Address, oldPrice)

		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(newPrice).toString())
		await checkApiPunkMarketBidExists(wallet2Address, newPrice)
	}, TEST_TIMEOUT)

	test("test update bid by punk market using SDK", async () => {
		const price = 8
		const balanceBefore2 = await web32.eth.getBalance(wallet2Address)
		const bid = await createPunkMarketBid(wallet2Address, price, web32, cryptoPunks2)
		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(price).toString())

		const newPrice = 10
		await runLogging(
			"update bid using SDK API",
			sdk2.order.bidUpdate({
				order: bid,
				price: newPrice,
			})
		)

		await checkPunkMarketBidExists(cryptoPunks2, wallet2Address, newPrice)
		await checkApiPunkMarketBidExists(wallet2Address, newPrice)

		await withdrawEth(web32, cryptoPunks2, wallet2Address, price)
		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(newPrice).toString())
	}, TEST_TIMEOUT)

	test("test punk bids from different users", async () => {
		const price = 8
		await createPunkMarketBid(wallet2Address, price, web32, cryptoPunks2)

		const newPrice = 10
		await createPunkMarketBid(wallet3Address, newPrice, web33, cryptoPunks3)

		await checkApiNoMarketBids(wallet2Address)
		await checkApiPunkMarketBidExists(wallet3Address, newPrice)
	}, TEST_TIMEOUT)

	test("test bid by punk market and transfer for free from the owner", async () => {
		const price = 8
		await createPunkMarketBid(wallet2Address, price, web32, cryptoPunks2)
		await sdk1.nft.transfer(ASSET_TYPE_CRYPTO_PUNK, toAddress(wallet2Address))
		await checkPunkMarketBidNotExists(cryptoPunks2)
		// Bid is cancelled because the bidder got the punk for free.
		await checkApiNoMarketBids(wallet2Address)
	}, TEST_TIMEOUT)

	test("test punk bid and rarible bid creation", async () => {
		const punkMarketPrice = 8
		await createPunkMarketBid(wallet2Address, punkMarketPrice, web32, cryptoPunks2)

		const rariblePrice = 10
		await createRaribleBidOrder(wallet2Address, ASSET_TYPE_ERC20, rariblePrice, sdk2)

		// Both bids exist because they are in different currencies.
		await checkApiPunkMarketBidExists(wallet2Address, punkMarketPrice)
		await checkApiRaribleBidExists(wallet2Address, rariblePrice)
	}, TEST_TIMEOUT)

	test("test buy using rarible bid with erc20", async () => {
		await buyUsingRaribleBidWithErc20(false)
	}, TEST_TIMEOUT)

	test("test buy using rarible bid with erc20 with existing rarible sell order", async () => {
		await buyUsingRaribleBidWithErc20(true)
	}, TEST_TIMEOUT)

	test("test buy using rarible bid with erc20 with existing punk sell order", async () => {
		await buyUsingRaribleBidWithErc20(false, true)
	}, TEST_TIMEOUT)

	async function buyUsingRaribleBidWithErc20(
		withExistingRaribleSellOrder: boolean,
		withExistingPunkMarketSellOrder: boolean = false
	) {
		if (withExistingRaribleSellOrder && withExistingPunkMarketSellOrder) {
			throw new Error("check supports case with either rarible or punk order")
		}
		if (withExistingRaribleSellOrder) {
			const rariblePrice = 10
			await createRaribleSellOrder(wallet1Address, ASSET_TYPE_ERC20, rariblePrice, sdk1)
		}
		if (withExistingPunkMarketSellOrder) {
			const punkMarketPrice = 28
			await createPunkMarketSellOrder(wallet1Address, punkMarketPrice, cryptoPunks1)
		}

		const bidPrice = 24
		const bid = await createRaribleBidOrder(wallet2Address, ASSET_TYPE_ERC20, bidPrice, sdk2)
		await fillOrder(bid, sdk1)
		await verifyErc20Balance(erc20, wallet1Address, bidPrice)
		await verifyErc20Balance(erc20, wallet2Address, initErc20Balance - bidPrice)
		await verifyCryptoPunkOwner(cryptoPunks2, punkIndex, wallet2Address)
		await awaitNoOwnership(cryptoPunksAddress, punkIndex, wallet1Address)
		await awaitOwnershipValueToBe(cryptoPunksAddress, punkIndex, wallet2Address, 1)
		if (withExistingRaribleSellOrder) {
			// Punk was sold via accepting bid => the sell order must be cancelled.
			await checkApiNoRaribleSellOrders()
		}
		if (withExistingPunkMarketSellOrder) {
			// Punk was sold => punk market sell order must be cancelled.
			await checkApiNoMarketSellOrders()
		}
	}

	test("test buy using bid by punk market", async () => {
		await buyUsingBidByPunkMarket(false)
	}, TEST_TIMEOUT)

	test("test buy using bid by punk market with existing rarible order", async () => {
		await buyUsingBidByPunkMarket(true)
	}, TEST_TIMEOUT)

	test("test buy using bid by punk market with existing punk order", async () => {
		await buyUsingBidByPunkMarket(false, true)
	}, TEST_TIMEOUT)

	async function buyUsingBidByPunkMarket(
		withExistingRaribleSellOrder: boolean,
		withExistingPunkMarketSellOrder: boolean = false
	) {
		if (withExistingRaribleSellOrder && withExistingPunkMarketSellOrder) {
			throw new Error("check supports case with either rarible or punk order")
		}

		const balanceBefore1 = await web31.eth.getBalance(wallet1Address)
		const balanceBefore2 = await web32.eth.getBalance(wallet2Address)
		if (withExistingRaribleSellOrder) {
			const price = 10
			await createRaribleSellOrder(wallet1Address, ASSET_TYPE_ETH, price, sdk1)
		}
		if (withExistingPunkMarketSellOrder) {
			const minPrice = 28
			await createPunkMarketSellOrder(wallet1Address, minPrice, cryptoPunks1)
		}

		const price = 5
		const bid = await createPunkMarketBid(wallet2Address, price, web32, cryptoPunks2)
		await fillOrder(bid, sdk1)

		await checkPunkMarketBidNotExists(cryptoPunks2)
		await checkApiNoMarketBids(wallet2Address)

		await withdrawEth(web31, cryptoPunks1, wallet1Address, price)
		await verifyEthBalance(web31, toAddress(wallet1Address), toBn(balanceBefore1).plus(price).toString())
		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(price).toString())

		await verifyCryptoPunkOwner(cryptoPunks2, punkIndex, wallet2Address)
		await awaitNoOwnership(cryptoPunksAddress, punkIndex, wallet1Address)
		await awaitOwnershipValueToBe(cryptoPunksAddress, punkIndex, wallet2Address, 1)

		if (withExistingRaribleSellOrder) {
			// Sell order must be cancelled because the punk was sold via 'accept bid'
			await checkApiNoRaribleSellOrders()
		}
		if (withExistingPunkMarketSellOrder) {
			await checkApiNoMarketSellOrders()
		}
	}
})
