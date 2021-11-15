import { createRaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { toAddress } from "@rarible/types"
import { Web3Ethereum } from "@rarible/web3-ethereum"
import { Contract } from "web3-eth-contract"
import { GetSellOrdersByItemRequest } from "@rarible/ethereum-api-client"
import { EthereumContract } from "@rarible/ethereum-provider"
import { RaribleV2Order } from "@rarible/ethereum-api-client"
import { awaitOwnershipValueToBe } from "./common/await-ownership-value-to-be"
import { awaitNoOwnership } from "./common/await-no-ownership"
import { initProviders } from "./common/init-providers"
import { verifyErc721Balance } from "./common/verify-erc721-balance"
import { verifyCryptoPunkOwner } from "./common/verify-crypto-punk-owner"
import { cryptoPunksContract, cryptoPunksEthereumContract } from "./contracts/crypto-punks"
import { verifyEthBalance } from "./common/verify-eth-balance"
import { toBn } from "./common/to-bn"

describe("crypto punks test", function () {

	const { web31, web32, wallet1, wallet2 } = initProviders({
		pk1: "0x00120de4b1518cf1f16dc1b02f6b4a8ac29e870174cb1d8575f578480930250a",
		pk2: "0xa0d2baba419896add0b6e638ba4e50190f331db18e3271760b12ce87fa853dcb",
	})
	const sdk1 = createRaribleSdk(new Web3Ethereum({ web3: web31 }), "e2e")
	const wallet1Address = wallet1.getAddressString()
	const nftOwnership = sdk1.apis.nftOwnership
	const ethereum1 = new Web3Ethereum({ web3: web31 })

	const sdk2 = createRaribleSdk(new Web3Ethereum({ web3: web32 }), "e2e")
	const wallet2Address = wallet2.getAddressString()

	let cryptoPunks: Contract
	let cryptoPunksEC: EthereumContract
	let cryptoPunksAddress: string
	const punkIndex = 9

	async function beforeTests() {
		// checking initial addresses and their balance
		// address owns 10 punks
		expect(wallet1Address).toBe("0xc66d094ed928f7840a6b0d373c1cd825c97e3c7c")
		expect(wallet2Address).toBe("0x04c5e1adfdb11b293398120847fa2bda166a4584")

		cryptoPunks = await cryptoPunksContract(web31)
		cryptoPunksEC = cryptoPunksEthereumContract(ethereum1)
		cryptoPunksAddress = cryptoPunks.options.address

		await verifyErc721Balance(cryptoPunks, wallet1Address, 10)
		await verifyCryptoPunkOwner(cryptoPunks, punkIndex, wallet1Address)
		await verifyErc721Balance(cryptoPunks, wallet2Address, 0)

		await awaitNoOwnership(nftOwnership, cryptoPunksAddress, punkIndex, wallet2Address)
		await awaitOwnershipValueToBe(nftOwnership, cryptoPunks.options.address, punkIndex, wallet1Address, 1)
	}

	test("test failed transfer by not an owner", async () => {
		await beforeTests()

		await expect(async () => {
			await sdk2.nft.transferCryptoPunks(
				{
					assetClass: "CRYPTO_PUNKS",
					contract: toAddress(cryptoPunksAddress),
					punkId: punkIndex,
				},
				toAddress(wallet1Address)
			)
		}).rejects.toThrowError("has not any ownerships of punk with Id")
	})

	test("test transfer", async () => {
		await beforeTests()

		await sdk1.nft.transferCryptoPunks(
			{
				assetClass: "CRYPTO_PUNKS",
				contract: toAddress(cryptoPunksAddress),
				punkId: punkIndex,
			},
			toAddress(wallet2Address)
		)
		await verifyCryptoPunkOwner(cryptoPunks, punkIndex, wallet2Address)
		await awaitNoOwnership(nftOwnership, cryptoPunksAddress, punkIndex, wallet1Address)
		await awaitOwnershipValueToBe(nftOwnership, cryptoPunks.options.address, punkIndex, wallet2Address, 1)

		await transferPunkBackToInitialOwner()

	}, 30000)

	test("test buy for eth by rarible order", async () => {
		await beforeTests()

		const price = 7

		// create new rarible order
		// const order = await sdk1.order.sell.start({
		// 	makeAssetType: {
		// 		assetClass: "CRYPTO_PUNKS",
		// 		contract: toAddress(cryptoPunksAddress),
		// 		punkId: punkIndex,
		// 	},
		// 	amount: 1,
		// 	maker: toAddress(wallet1Address),
		// 	originFees: [],
		// 	payouts: [],
		// 	price: price,
		// 	takeAssetType: { assetClass: "ETH" },
		// }).runAll()

		// get existing order
		const orders = (await sdk1.apis.order.getSellOrdersByItem({
			contract: cryptoPunksAddress,
			tokenId: punkIndex.toString(),
		} as GetSellOrdersByItemRequest)).orders
		const raribleOrder = orders
			.filter(a => a["type"] === "RARIBLE_V2")
			.map(o => o as RaribleV2Order)
		expect(raribleOrder.length).toBeGreaterThan(0)

		const order = raribleOrder[0]
		console.log(`order: ${JSON.stringify(order)}`)


		const balanceBefore = await web32.eth.getBalance(wallet2Address)

		try {
			await sdk2.order.fill({
				order,
				originFee: 0,
				amount: 1,
				infinite: true,
			})
		} catch (e) {
			console.log("error with RaribleV2OrderFillRequest: " + e)
		}

		try {
			await sdk2.order.fill({
				order,
				originFee: 0,
				amount: 1,
				infinite: true,
			})
		} catch (e) {
			console.log("error with CryptoPunksOrderFillRequest: " + e)
			throw new Error(`fill order failed with error: ${e}`)
		}

		await verifyEthBalance(web32, toAddress(wallet2Address), toBn(balanceBefore).minus(price).toString())

		await verifyCryptoPunkOwner(cryptoPunks, punkIndex, wallet2Address)
		await awaitNoOwnership(nftOwnership, cryptoPunksAddress, punkIndex, wallet1Address)
		await awaitOwnershipValueToBe(nftOwnership, cryptoPunks.options.address, punkIndex, wallet2Address, 1)

		await transferPunkBackToInitialOwner()

	}, 30000)


	test("test buy for eth by crypto punk market", async () => {
		await beforeTests()

		const minPrice = 8
		// await cryptoPunksEC.functionCall("offerPunkForSale", punkIndex, minPrice).send()
		//
		const forSale = await cryptoPunks.methods.punksOfferedForSale(punkIndex).call()
		console.log(`forSale: ${JSON.stringify(forSale)}`)
		expect(forSale.isForSale).toBe(true)
		expect(forSale.seller.toLowerCase()).toBe(wallet1Address)
		expect(forSale.minValue).toBe(minPrice.toString())
		expect(forSale.punkIndex).toBe(punkIndex.toString())

		const orders = (await sdk1.apis.order.getSellOrdersByItem({
			contract: cryptoPunksAddress,
			tokenId: punkIndex.toString(),
		})).orders
		// const raribleOrder = orders.filter(a => a["type"] === "CRYPTO_PUNK")
		// expect(raribleOrder.length).toBeGreaterThan(0)
		console.log(`orders: ${JSON.stringify(orders)}`)
	}, 30000)

	async function transferPunkBackToInitialOwner() {
		await sdk2.nft.transferCryptoPunks(
			{
				assetClass: "CRYPTO_PUNKS",
				contract: toAddress(cryptoPunksAddress),
				punkId: punkIndex,
			},
			toAddress(wallet1Address)
		)
		await verifyCryptoPunkOwner(cryptoPunks, punkIndex, wallet1Address)
		await awaitNoOwnership(nftOwnership, cryptoPunksAddress, punkIndex, wallet2Address)
		await awaitOwnershipValueToBe(nftOwnership, cryptoPunks.options.address, punkIndex, wallet1Address, 1)
	}
})
