import {createRaribleSdk, RaribleSdk} from "@rarible/protocol-ethereum-sdk"
import {toAddress} from "@rarible/types"
import {Web3Ethereum} from "@rarible/web3-ethereum"
import {Contract} from "web3-eth-contract"
import {CryptoPunksAssetType, Erc20AssetType} from "@rarible/ethereum-api-client/build/models"
import {e2eConfig} from "@rarible/protocol-ethereum-sdk/build/config/e2e"
import {RaribleV2Order} from "@rarible/ethereum-api-client"
import {CryptoPunkOrder} from "@rarible/ethereum-api-client/build/models/Order"
import {awaitOwnershipValueToBe} from "./common/await-ownership-value-to-be"
import {awaitNoOwnership} from "./common/await-no-ownership"
import {initProvider} from "./common/init-providers"
import {verifyErc721Balance} from "./common/verify-erc721-balance"
import {verifyCryptoPunkOwner} from "./common/verify-crypto-punk-owner"
import {cryptoPunksAddress, cryptoPunksContract} from "./contracts/crypto-punks"
import {verifyEthBalance} from "./common/verify-eth-balance"
import {toBn} from "./common/to-bn"
import {deployTestErc20, erc20Mint} from "./contracts/test-erc20"
import {verifyErc20Balance} from "./common/verify-erc20-balance"
import {ASSET_TYPE_ETH, printLog, runLogging, TEST_TIMEOUT, ZERO_ADDRESS} from "./common/util"
import {
	checkPunkMarketBidExists,
	checkPunkMarketBidNotExists,
	createPunkMarketBid,
} from "./cryptoPunks/punk-market-bid"
import {
	checkPunkMarketSellOrderExists,
	checkPunkMarketNotForSale,
	createPunkMarketSellOrder,
} from "./cryptoPunks/punk-market-sell"
import {punkMarketWithdrawEth} from "./cryptoPunks/punk-market-withdraw-eth"
import {checkApiBidExists, checkApiNoBids, createRaribleBidOrder, getApiRaribleBids} from "./common/api-bid"
import {
	checkApiNoSellOrders,
	checkApiSellOrderExists,
	createRaribleSellOrder,
	getApiRaribleSellOrders,
} from "./common/api-sell"
import {fillOrder} from "./common/fill-order"

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

	// The punk index to trade in the test.
	const punkIndex = 7

	const ASSET_TYPE_CRYPTO_PUNK: CryptoPunksAssetType = {
		assetClass: "CRYPTO_PUNKS",
		contract: toAddress(cryptoPunksAddress),
		tokenId: punkIndex,
	}

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

		// Return punk back to initial owner.
		const realOwner = await cryptoPunks1.methods.punkIndexToAddress(punkIndex).call()
		if (realOwner.toLowerCase() !== wallet1Address) {
			let contractToUse: Contract
			if (realOwner.toLowerCase() === wallet2Address) {
				contractToUse = cryptoPunks2
			} else if (realOwner.toLowerCase() === wallet3Address) {
				contractToUse = cryptoPunks3
			} else {
				throw new Error(`Punk ${punkIndex} belongs to unknown address ${realOwner}`)
			}
			await contractToUse.methods.transferPunk(
				toAddress(wallet1Address), punkIndex).send({from: realOwner.toLowerCase()}
			)
		}

		// Cancel leftover punk market bids
		const punkMarketRawBid = await cryptoPunks1.methods.punkBids(punkIndex).call()
		const bidder = punkMarketRawBid.bidder.toString().toLowerCase()
		if (bidder !== ZERO_ADDRESS.toLowerCase()) {
			let contractToUse: Contract
			if (bidder === wallet1Address) {
				contractToUse = cryptoPunks1
			} else if (bidder === wallet2Address) {
				contractToUse = cryptoPunks2
			} else if (bidder === wallet3Address) {
				contractToUse = cryptoPunks3
			} else {
				throw new Error(`Unknown bidder ${bidder}`)
			}
			await runLogging(
				`Cancelling raw bid from ${bidder}`,
				contractToUse.methods.withdrawBidForPunk(punkIndex).send({ from: bidder })
			)
			return
		}

		// Cancel leftover punk market sell order.
		const punkMarketForSaleRaw = await cryptoPunks1.methods.punksOfferedForSale(punkIndex).call()
		if (punkMarketForSaleRaw.isForSale) {
			let seller = punkMarketForSaleRaw.seller.toLowerCase()
			let contractToUse: Contract
			if (seller === wallet1Address) {
				contractToUse = cryptoPunks1
			} else if (seller === wallet2Address) {
				contractToUse = cryptoPunks2
			} else if (seller === wallet3Address) {
				contractToUse = cryptoPunks3
			} else {
				throw new Error(`Unknown seller ${seller}`)
			}
			await runLogging(
				`Cancelling raw sell order from ${seller}`,
				contractToUse.methods.punkNoLongerForSale(punkIndex).send({from: seller})
			)
		}

		// Cancel leftover bid from previous tests
		let leftOverBids: [string, RaribleSdk, RaribleV2Order[]][] = [
			[wallet1Address, sdk1, await getApiRaribleBids(cryptoPunksAddress, punkIndex.toString(), wallet1Address)],
			[wallet2Address, sdk2, await getApiRaribleBids(cryptoPunksAddress, punkIndex.toString(), wallet2Address)],
			[wallet3Address, sdk3, await getApiRaribleBids(cryptoPunksAddress, punkIndex.toString(), wallet3Address)],
		]
		for (const [wallet, sdk, bids] of leftOverBids) {
			if (bids.length > 0) {
				printLog(`Leftover bid to cancel from ${wallet}: ${bids.length}: ${JSON.stringify(bids)}`)
				for (const bid of bids) {
					await runLogging(
						`cancel leftover bid ${JSON.stringify(bid)}`,
						sdk.order.cancel(bid)
					)
				}
			}
		}

		// Cancel leftover sell orders from previous tests
		let leftOverSellOrders: [string, RaribleSdk, RaribleV2Order[]][] = [
			[wallet1Address, sdk1, await getApiRaribleSellOrders(cryptoPunksAddress, punkIndex.toString(), wallet1Address)],
			[wallet2Address, sdk2, await getApiRaribleSellOrders(cryptoPunksAddress, punkIndex.toString(), wallet2Address)],
			[wallet3Address, sdk3, await getApiRaribleSellOrders(cryptoPunksAddress, punkIndex.toString(), wallet3Address)],
		]
		for (const [wallet, sdk, sellOrders] of leftOverSellOrders) {
			if (sellOrders.length > 0) {
				printLog(`Leftover sell orders to cancel from ${wallet}: ${sellOrders.length}: ${JSON.stringify(sellOrders)}`)
				for (const sellOrder of sellOrders) {
					await runLogging(
						`cancel leftover sell order ${JSON.stringify(sellOrder)}`,
						sdk.order.cancel(sellOrder)
					)
				}
			}
		}
		await checkApiNoBids(cryptoPunksAddress, punkIndex.toString(), undefined)
		await checkApiNoSellOrders(cryptoPunksAddress, punkIndex.toString(), undefined)

		await verifyErc721Balance(cryptoPunks1, wallet1Address, 10)
		await verifyErc721Balance(cryptoPunks2, wallet2Address, 0)
		await verifyErc721Balance(cryptoPunks3, wallet3Address, 0)

		await verifyCryptoPunkOwner(cryptoPunks1, punkIndex, wallet1Address)

		await awaitOwnershipValueToBe(cryptoPunksAddress, punkIndex, wallet1Address, 1)
		await awaitNoOwnership(cryptoPunksAddress, punkIndex, wallet2Address)
		await awaitNoOwnership(cryptoPunksAddress, punkIndex, wallet3Address)

		await punkMarketWithdrawEth(web31, cryptoPunks1, wallet1Address)
		await punkMarketWithdrawEth(web32, cryptoPunks2, wallet2Address)
		await punkMarketWithdrawEth(web33, cryptoPunks3, wallet3Address)
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

		let raribleBid: RaribleV2Order
		if (withExistingRaribleBid) {
			raribleBid = await createRaribleBidOrder(wallet2Address, 17, ASSET_TYPE_ERC20, ASSET_TYPE_CRYPTO_PUNK, sdk2)
		}

		const punkBidPrice = 5
		if (withExistingPunkBid) {
			await createPunkMarketBid(wallet2Address, punkIndex, punkBidPrice, web32, cryptoPunks2)
		}

		const price = 7
		let sellOrder = await createRaribleSellOrder(wallet1Address, ASSET_TYPE_CRYPTO_PUNK, ASSET_TYPE_ETH, price, sdk1)

		await fillOrder(sellOrder, sdk2)
		await checkApiNoSellOrders(cryptoPunksAddress, punkIndex.toString(), undefined)

		// Check balances.
		await verifyEthBalance(web31, toAddress(wallet1Address), toBn(balanceBefore1).plus(price).toString())
		if (withExistingPunkBid) {
			// Punk bid must be cancelled and ETH returned to the buyer.
			expect(await punkMarketWithdrawEth(web32, cryptoPunks2, wallet2Address)).toStrictEqual(punkBidPrice)

			// Punk market bid must be deleted (because the bidder got the punk via sale).
			await checkApiNoBids(cryptoPunksAddress, punkIndex.toString(), wallet2Address)
		}
		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(price).toString())

		if (withExistingRaribleBid) {
			// The Rarible bid must survive.
			await checkApiBidExists(raribleBid!!)
		}

		await verifyCryptoPunkOwner(cryptoPunks2, punkIndex, wallet2Address)
		await awaitNoOwnership(cryptoPunksAddress, punkIndex, wallet1Address)
		await awaitOwnershipValueToBe(cryptoPunksAddress, punkIndex, wallet2Address, 1)
	}

	test("test sell for erc20 by rarible order", async () => {
		const price = 24
		let sellOrder = await createRaribleSellOrder(wallet1Address, ASSET_TYPE_CRYPTO_PUNK, ASSET_TYPE_ERC20, price, sdk1)
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
		let raribleBid: RaribleV2Order
		if (withExistingRaribleBid) {
			raribleBid = await createRaribleBidOrder(wallet2Address, 17, ASSET_TYPE_ERC20, ASSET_TYPE_CRYPTO_PUNK, sdk2)
		}
		const punkMarketBidPrice = 5
		if (withExistingPunkBid) {
			await createPunkMarketBid(wallet2Address, punkIndex, punkMarketBidPrice, web32, cryptoPunks2)
		}
		const sellPrice = 8
		const sellOrder = await createPunkMarketSellOrder(punkIndex, wallet1Address, sellPrice, cryptoPunks1)

		await fillOrder(sellOrder, sdk2)
		await checkApiNoSellOrders(cryptoPunksAddress, punkIndex.toString(), undefined)
		if (withExistingRaribleBid) {
			// Rarible bid must survive
			await checkApiBidExists(raribleBid!!)
		}
		if (withExistingPunkBid) {
			// Punk market bid must be cancelled (because the bidder got the punk he wanted).
			expect(await punkMarketWithdrawEth(web32, cryptoPunks2, wallet2Address)).toStrictEqual(punkMarketBidPrice)
			await checkPunkMarketBidNotExists(punkIndex, cryptoPunks2)
			await checkApiNoBids(cryptoPunksAddress, punkIndex.toString(), wallet2Address)
		}
		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(sellPrice).toString())
		await verifyCryptoPunkOwner(cryptoPunks2, punkIndex, wallet2Address)
		await awaitNoOwnership(cryptoPunksAddress, punkIndex, wallet1Address)
		await awaitOwnershipValueToBe(cryptoPunksAddress, punkIndex, wallet2Address, 1)
	}

	test("test sell to specific address by punk market", async () => {
		const price = 7
		const sellOrder = await createPunkMarketSellOrder(punkIndex, wallet1Address, price, cryptoPunks1, wallet2Address)
		const balanceBefore2 = await web32.eth.getBalance(wallet2Address)
		await fillOrder(sellOrder, sdk2)
		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(price).toString())
		await verifyCryptoPunkOwner(cryptoPunks1, punkIndex, wallet2Address)
		await awaitNoOwnership(cryptoPunksAddress, punkIndex, wallet1Address)
		await awaitOwnershipValueToBe(cryptoPunksAddress, punkIndex, wallet2Address, 1)
	}, TEST_TIMEOUT)

	test("test cancel rarible order because punk market sell order is created", async () => {
		const rariblePrice = 7
		await createRaribleSellOrder(wallet1Address, ASSET_TYPE_CRYPTO_PUNK, ASSET_TYPE_ETH, rariblePrice, sdk1)

		const punkMarketPrice = 8
		await createPunkMarketSellOrder(punkIndex, wallet1Address, punkMarketPrice, cryptoPunks1)

		// Rarible sell order must be deleted because the approval for Rarible order is removed.
		await checkApiNoSellOrders(cryptoPunksAddress, punkIndex.toString(), undefined, "RARIBLE_V2")
	}, TEST_TIMEOUT)


	test("test replace punk market sell order with rarible sell order approval", async () => {
		const punkMarketPrice = 8
		await createPunkMarketSellOrder(punkIndex, wallet1Address, punkMarketPrice, cryptoPunks1)

		const rariblePrice = 7
		let raribleSellOrder = await createRaribleSellOrder(
			wallet1Address, ASSET_TYPE_CRYPTO_PUNK, ASSET_TYPE_ETH, rariblePrice, sdk1
		)

		await checkPunkMarketSellOrderExists(
			punkIndex,
			cryptoPunks1,
			wallet1Address,
			0,
			e2eConfig.transferProxies.cryptoPunks.toLowerCase()
		)

		await checkApiSellOrderExists(raribleSellOrder)
		await checkApiNoSellOrders(cryptoPunksAddress, punkIndex.toString(), undefined, "CRYPTO_PUNK")
	}, TEST_TIMEOUT)

	test("test cancel rarible sell order", async () => {
		const price = 24
		let order = await createRaribleSellOrder(wallet1Address, ASSET_TYPE_CRYPTO_PUNK, ASSET_TYPE_ERC20, price, sdk1)
		await checkPunkMarketSellOrderExists(
			punkIndex,
			cryptoPunks1,
			wallet1Address,
			0,
			e2eConfig.transferProxies.cryptoPunks.toLowerCase()
		)
		await sdk1.order.cancel(order)
		await checkApiNoSellOrders(cryptoPunksAddress, punkIndex.toString(), undefined)
		// Punk market sell order approval still exists.
		await checkPunkMarketSellOrderExists(
			punkIndex,
			cryptoPunks1,
			wallet1Address,
			0,
			e2eConfig.transferProxies.cryptoPunks.toLowerCase()
		)
	}, TEST_TIMEOUT)

	test("test cancel sell order by punk market", async () => {
		const price = 8
		await createPunkMarketSellOrder(punkIndex, wallet1Address, price, cryptoPunks1)
		await cryptoPunks1.methods.punkNoLongerForSale(punkIndex).send({from: wallet1Address})
		await checkApiNoSellOrders(cryptoPunksAddress, punkIndex.toString(), undefined)
	}, TEST_TIMEOUT)

	test("test update sell order by punk market using api", async () => {
		const price = 8
		const sellOrder = await createPunkMarketSellOrder(punkIndex, wallet1Address, price, cryptoPunks1)

		const newPrice = 10
		let updatedSellOrder = await runLogging(
			`update sell order ${sellOrder}`,
			sdk1.order.sellUpdate({
				order: sellOrder,
				price: newPrice,
			})
		) as CryptoPunkOrder

		await checkPunkMarketSellOrderExists(punkIndex, cryptoPunks1, wallet1Address, newPrice)
		await checkApiSellOrderExists(updatedSellOrder)
	}, TEST_TIMEOUT)

	test("test punk market sell order and transfer for free", async () => {
		await createPunkMarketSellOrder(punkIndex, wallet1Address, 8, cryptoPunks1)
		await sdk1.nft.transfer(ASSET_TYPE_CRYPTO_PUNK, toAddress(wallet2Address))
		await checkPunkMarketNotForSale(punkIndex, cryptoPunks1)
		await checkApiNoSellOrders(cryptoPunksAddress, punkIndex.toString(), undefined)
	}, TEST_TIMEOUT)

	test("test cancel bid by punk market", async () => {
		const price = 8
		const balanceBefore2 = await web32.eth.getBalance(wallet2Address)
		await createPunkMarketBid(wallet2Address, punkIndex, price, web32, cryptoPunks2)
		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(price).toString())
		await cryptoPunks2.methods.withdrawBidForPunk(punkIndex).send({from: wallet2Address})
		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).toString())
		await checkPunkMarketBidNotExists(punkIndex, cryptoPunks2)
		await checkApiNoBids(cryptoPunksAddress, punkIndex.toString(), wallet2Address)
	}, TEST_TIMEOUT)

	test("test cancel bid by punk market using api", async () => {
		const price = 8
		const balanceBefore2 = await web32.eth.getBalance(wallet2Address)
		const bid = await createPunkMarketBid(wallet2Address, punkIndex, price, web32, cryptoPunks2)
		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(price).toString())
		await runLogging(
			`cancel bid ${bid}`,
			sdk2.order.cancel(bid)
		)
		await checkPunkMarketBidNotExists(punkIndex, cryptoPunks2)
		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).toString())
		await checkApiNoBids(cryptoPunksAddress, punkIndex.toString(), wallet2Address)
	}, TEST_TIMEOUT)

	test("test update bid by punk market", async () => {
		const oldPrice = 8
		const balanceBefore2 = await web32.eth.getBalance(wallet2Address)
		await createPunkMarketBid(wallet2Address, punkIndex, oldPrice, web32, cryptoPunks2)
		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(oldPrice).toString())

		const newPrice = 10
		let punkMarketBid = await createPunkMarketBid(wallet2Address, punkIndex, newPrice, web32, cryptoPunks2)
		expect(await punkMarketWithdrawEth(web32, cryptoPunks2, wallet2Address)).toStrictEqual(oldPrice)

		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(newPrice).toString())
		await checkApiBidExists(punkMarketBid)
	}, TEST_TIMEOUT)

	test("test update bid by punk market using SDK", async () => {
		const price = 8
		const balanceBefore2 = await web32.eth.getBalance(wallet2Address)
		const bid = await createPunkMarketBid(wallet2Address, punkIndex, price, web32, cryptoPunks2)
		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(price).toString())

		const newPrice = 10
		let updatedBid = await runLogging(
			"update bid using SDK API",
			sdk2.order.bidUpdate({
				order: bid,
				price: newPrice,
			})
		) as CryptoPunkOrder

		await checkPunkMarketBidExists(punkIndex, wallet2Address, newPrice, cryptoPunks2)
		await checkApiBidExists(updatedBid)

		expect(await punkMarketWithdrawEth(web32, cryptoPunks2, wallet2Address)).toStrictEqual(price)
		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(newPrice).toString())
	}, TEST_TIMEOUT)

	test("test punk bids from different users", async () => {
		const price = 8
		await createPunkMarketBid(wallet2Address, punkIndex, price, web32, cryptoPunks2)

		const newPrice = 10
		let secondBid = await createPunkMarketBid(wallet3Address, punkIndex, newPrice, web33, cryptoPunks3)

		await checkApiNoBids(cryptoPunksAddress, punkIndex.toString(), wallet2Address)
		await checkApiBidExists(secondBid)
	}, TEST_TIMEOUT)

	test("test bid by punk market and transfer for free from the owner", async () => {
		const price = 8
		await createPunkMarketBid(wallet2Address, punkIndex, price, web32, cryptoPunks2)
		await sdk1.nft.transfer(ASSET_TYPE_CRYPTO_PUNK, toAddress(wallet2Address))
		await checkPunkMarketBidNotExists(punkIndex, cryptoPunks2)
		// Bid is cancelled because the bidder got the punk for free.
		await checkApiNoBids(cryptoPunksAddress, punkIndex.toString(), wallet2Address)
	}, TEST_TIMEOUT)

	test("test punk bid and rarible bid creation", async () => {
		const punkMarketPrice = 8
		let punkMarketBid = await createPunkMarketBid(wallet2Address, punkIndex, punkMarketPrice, web32, cryptoPunks2)

		const rariblePrice = 10
		let raribleBid = await createRaribleBidOrder(
			wallet2Address, rariblePrice, ASSET_TYPE_ERC20, ASSET_TYPE_CRYPTO_PUNK, sdk2
		)

		// Both bids exist because they are in different currencies.
		await checkApiBidExists(punkMarketBid)
		await checkApiBidExists(raribleBid)
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
			await createRaribleSellOrder(wallet1Address, ASSET_TYPE_CRYPTO_PUNK, ASSET_TYPE_ERC20, rariblePrice, sdk1)
		}
		if (withExistingPunkMarketSellOrder) {
			const punkMarketPrice = 28
			await createPunkMarketSellOrder(punkIndex, wallet1Address, punkMarketPrice, cryptoPunks1)
		}

		const bidPrice = 24
		const bid = await createRaribleBidOrder(wallet2Address, bidPrice, ASSET_TYPE_ERC20, ASSET_TYPE_CRYPTO_PUNK, sdk2)
		await fillOrder(bid, sdk1)
		await verifyErc20Balance(erc20, wallet1Address, bidPrice)
		await verifyErc20Balance(erc20, wallet2Address, initErc20Balance - bidPrice)
		await verifyCryptoPunkOwner(cryptoPunks2, punkIndex, wallet2Address)
		await awaitNoOwnership(cryptoPunksAddress, punkIndex, wallet1Address)
		await awaitOwnershipValueToBe(cryptoPunksAddress, punkIndex, wallet2Address, 1)
		if (withExistingRaribleSellOrder) {
			// Punk was sold via accepting bid => the sell order must be cancelled.
			await checkApiNoSellOrders(cryptoPunksAddress, punkIndex.toString(), undefined)
		}
		if (withExistingPunkMarketSellOrder) {
			// Punk was sold => punk market sell order must be cancelled.
			await checkApiNoSellOrders(cryptoPunksAddress, punkIndex.toString(), undefined)
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
			await createRaribleSellOrder(wallet1Address, ASSET_TYPE_CRYPTO_PUNK, ASSET_TYPE_ETH, price, sdk1)
		}
		if (withExistingPunkMarketSellOrder) {
			const minPrice = 28
			await createPunkMarketSellOrder(punkIndex, wallet1Address, minPrice, cryptoPunks1)
		}

		const price = 5
		const bid = await createPunkMarketBid(wallet2Address, punkIndex, price, web32, cryptoPunks2)
		await fillOrder(bid, sdk1)

		await checkPunkMarketBidNotExists(punkIndex, cryptoPunks2)
		await checkApiNoBids(cryptoPunksAddress, punkIndex.toString(), wallet2Address)

		expect(await punkMarketWithdrawEth(web31, cryptoPunks1, wallet1Address)).toStrictEqual(price)
		await verifyEthBalance(web31, toAddress(wallet1Address), toBn(balanceBefore1).plus(price).toString())
		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore2).minus(price).toString())

		await verifyCryptoPunkOwner(cryptoPunks2, punkIndex, wallet2Address)
		await awaitNoOwnership(cryptoPunksAddress, punkIndex, wallet1Address)
		await awaitOwnershipValueToBe(cryptoPunksAddress, punkIndex, wallet2Address, 1)

		if (withExistingRaribleSellOrder) {
			// Sell order must be cancelled because the punk was sold via 'accept bid'
			await checkApiNoSellOrders(cryptoPunksAddress, punkIndex.toString(), undefined)
		}
		if (withExistingPunkMarketSellOrder) {
			await checkApiNoSellOrders(cryptoPunksAddress, punkIndex.toString(), undefined, "CRYPTO_PUNK")
		}
	}
})
