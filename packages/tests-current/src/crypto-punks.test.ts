import { createRaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { toAddress, toBigNumber } from "@rarible/types"
import { Web3Ethereum } from "@rarible/web3-ethereum"
import { Contract } from "web3-eth-contract"
import { Platform, RaribleV2Order } from "@rarible/ethereum-api-client"
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

	async function init() {
		// checking initial addresses
		expect(wallet1Address).toBe("0xc66d094ed928f7840a6b0d373c1cd825c97e3c7c")
		expect(wallet2Address).toBe("0x04c5e1adfdb11b293398120847fa2bda166a4584")

		cryptoPunks1 = await cryptoPunksContract(web31)
		cryptoPunksAddress = cryptoPunks1.options.address

		cryptoPunks2 = await cryptoPunksContract(web32)
	}

	async function beforeTests() {
		await init()

		// checking initial balances
		// address owns 10 punks
		await verifyErc721Balance(cryptoPunks1, wallet1Address, 10)
		await verifyCryptoPunkOwner(cryptoPunks1, punkIndex, wallet1Address)
		await verifyErc721Balance(cryptoPunks1, wallet2Address, 0)

		await awaitNoOwnership(nftOwnership, cryptoPunksAddress, punkIndex, wallet2Address)
		await awaitOwnershipValueToBe(nftOwnership, cryptoPunks1.options.address, punkIndex, wallet1Address, 1)
	}

	test("check state before test", async () => {
		await beforeTests()
	})

	// utility method
	// test("transfer back only", async () => {
	// 	await init()
	// 	await transferPunkBackToInitialOwner()
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
		await beforeTests()

		try {
			const price = 7

			// create new rarible order
			let order: RaribleV2Order
			try {
				order = await sdk1.order.sell({
					makeAssetType: {
						assetClass: "CRYPTO_PUNKS",
						contract: toAddress(cryptoPunksAddress),
						tokenId: punkIndex,
					},
					amount: 1,
					maker: toAddress(wallet1Address),
					originFees: [],
					payouts: [],
					price: price,
					takeAssetType: { assetClass: "ETH" },
				}) as RaribleV2Order
			} catch (e) {
				throw new Error(`order.sell failed with error: ${e}`)
			}

			console.log(`order: ${JSON.stringify(order)}`)

			checkCryptoPunkSellOrder(order, price)
			expectEqual(order.make.assetType.assetClass, "CRYPTO_PUNKS", "type of order.make.asset")
			expectEqual(order.make.value, "1", "order.make.value")
			expectEqual(order.makeStock, "1", "order.makeStock")
			expectEqual(order.maker, wallet1Address, "order.maker")

			expectEqual(order.taker, undefined, "order.taker")
			expectEqual(order.take.assetType.assetClass, "ETH", "type of order.take.asset")
			expectEqual(order.take.valueDecimal, Math.pow(10, -18) * price, "order.take.valueDecimal")

			const balanceBefore = await web32.eth.getBalance(wallet2Address)

			try {
				console.log("from", await web32.eth.getAccounts())
				await sdk2.order.fill({
					order,
					amount: 1,
					// infinite: true,
					// payouts: [{account: toAddress(wallet2Address), value: 10000}],
					// originFees: [],
				})
			} catch (e) {
				console.log("order.fill failed with error: " + e)
				throw new Error(`order.fill failed with error: ${e}`)
			}

			await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore).minus(price).toString())

			await verifyCryptoPunkOwner(cryptoPunks1, punkIndex, wallet2Address)
			await awaitNoOwnership(nftOwnership, cryptoPunksAddress, punkIndex, wallet1Address)
			await awaitOwnershipValueToBe(nftOwnership, cryptoPunks1.options.address, punkIndex, wallet2Address, 1)

		} finally {
			await transferPunkBackToInitialOwner()
		}
	}, 30000)

	test("test sell for eth by crypto punk market", async () => {
		await beforeTests()

		try {
			const minPrice = 8
			await cryptoPunks1.methods.offerPunkForSale(punkIndex, minPrice).send({ from: wallet1Address })
			const forSale = await cryptoPunks1.methods.punksOfferedForSale(punkIndex).call()
			console.log(`forSale: ${JSON.stringify(forSale)}`)
			expectEqual(forSale.isForSale, true, "cryptoPunk offer.isForSale")
			expectEqual(forSale.seller.toLowerCase(), wallet1Address, "cryptoPunk offer.seller")
			expectEqual(forSale.minValue, minPrice.toString(), "cryptoPunk offer.minValue")
			expectEqual(forSale.punkIndex, punkIndex.toString(), "cryptoPunk offer.punkIndex")

			let order = await retry(3, async () => {
				const cryptoPunkOrders = await getOrdersForPunkByType("CRYPTO_PUNK")
				expect(cryptoPunkOrders.length).toBeGreaterThan(0)
				return cryptoPunkOrders[0]
			})

			console.log(`order: ${JSON.stringify(order)}`)

			checkCryptoPunkSellOrder(order, minPrice)

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

	test("test sell to address for eth by crypto punk market", async () => {
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

			const cryptoPunkOrders = await getOrdersForPunkByType("CRYPTO_PUNK")
			expect(cryptoPunkOrders.length).toBeGreaterThan(0)

			const order = cryptoPunkOrders[0]
			console.log(`order: ${JSON.stringify(order)}`)

			checkCryptoPunkSellOrder(order, minPrice, wallet2Address)

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

	test("test cancel sell by crypto punk market", async () => {
		await beforeTests()

		const minPrice = 8
		await cryptoPunks1.methods.offerPunkForSale(punkIndex, minPrice).send({ from: wallet1Address })
		const forSaleTrue = await cryptoPunks1.methods.punksOfferedForSale(punkIndex).call()
		console.log(`forSale: ${JSON.stringify(forSaleTrue)}`)
		expectEqual(forSaleTrue.isForSale, true, "cryptoPunk offer.isForSale")

		await retry(3, async () => {
			const cryptoPunkOrders = await getOrdersForPunkByType("CRYPTO_PUNK")
			expect(cryptoPunkOrders.length).toBeGreaterThan(0)
		})

		await cryptoPunks1.methods.punkNoLongerForSale(punkIndex).send({ from: wallet1Address })
		const forSale = await cryptoPunks1.methods.punksOfferedForSale(punkIndex).call()
		console.log(`cancelled forSale: ${JSON.stringify(forSale)}`)
		expectEqual(forSale.isForSale, false, "cryptoPunk cancelled offer.isForSale")

		await retry(3, async () => {
			const cryptoPunkOrders = await getOrdersForPunkByType("CRYPTO_PUNK")
			expectEqual(cryptoPunkOrders.length, 0, "crypto punk orders quantity from api")
		})
	}, 30000)

	// todo wip
	test("test bid for eth by crypto punk market", async () => {
		await beforeTests()

		try {
			const price = 4
			await cryptoPunks2.methods.enterBidForPunk(punkIndex).send({ from: wallet2Address, value: price })
			const bid = await cryptoPunks2.methods.punkBids(punkIndex).call()
			console.log(`bid: ${JSON.stringify(bid)}`)
			expectEqual(bid.hasBid, true, "cryptoPunk bid.hasBid")
			expectEqual(bid.bidder.toLowerCase(), wallet2Address, "cryptoPunk bid.bidder")
			expectEqual(bid.value, price.toString(), "cryptoPunk bid.value")
			expectEqual(bid.punkIndex, punkIndex.toString(), "cryptoPunk bid.punkIndex")

			// await retry(3, async () => {
			// 	const cryptoPunkOrders = await getOrdersForPunkByType("CRYPTO_PUNK")
			// 	expect(cryptoPunkOrders.length).toBeGreaterThan(0)
			// })
			// const orders = (await sdk1.apis.order.getSellOrdersByItem({
			// 	contract: cryptoPunksAddress,
			// 	tokenId: punkIndex.toString(),
			// 	platform: Platform.ALL,
			// })).orders
			// const cryptoPunkOrders = orders
			// 	.filter(a => a["type"] === "CRYPTO_PUNK")
			// 	.map(o => o as RaribleV2Order)
			// expect(cryptoPunkOrders.length).toBeGreaterThan(0)
			//
			// const order = cryptoPunkOrders[0]
			// console.log(`order: ${JSON.stringify(order)}`)
			//
			// const balanceBefore = await web32.eth.getBalance(wallet2Address)
			//
			// try {
			// 	await sdk2.order.fill({
			// 		order,
			// 		amount: 1,
			// 		infinite: true,
			// 	})
			// } catch (e) {
			// 	throw new Error(`fill order failed with error: ${e}`)
			// }
			//
			// await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore).minus(price).toString())
			//
			// await verifyCryptoPunkOwner(cryptoPunks1, punkIndex, wallet2Address)
			// await awaitNoOwnership(nftOwnership, cryptoPunksAddress, punkIndex, wallet1Address)
			// await awaitOwnershipValueToBe(nftOwnership, cryptoPunks1.options.address, punkIndex, wallet2Address, 1)
		} finally {
			await transferPunkBackToInitialOwner()
		}

	}, 30000)

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

	async function getOrdersForPunkByType(type: String): Promise<RaribleV2Order[]> {
		const orders = (await sdk1.apis.order.getSellOrdersByItem({
			contract: cryptoPunksAddress,
			tokenId: punkIndex.toString(),
			platform: Platform.ALL,
		})).orders
		console.log(`orders: ${JSON.stringify(orders)}`)
		return orders
			.filter(a => a["type"] === type)
			.map(o => o as RaribleV2Order)
	}

	function checkCryptoPunkSellOrder(order: RaribleV2Order, price: number, taker: string | undefined = undefined) {
		expectEqual(order.make.assetType.assetClass, "CRYPTO_PUNKS", "type of order.make.asset")
		expectEqual(order.make.value, "1", "order.make.value")
		expectEqual(order.makeStock, "1", "order.makeStock")
		expectEqual(order.maker, wallet1Address, "order.maker")

		expectEqual(order.taker, taker, "order.taker")
		expectEqual(order.take.assetType.assetClass, "ETH", "type of order.take.asset")
		expectEqual(order.take.valueDecimal, Math.pow(10, -18) * price, "order.take.valueDecimal")
	}
})
