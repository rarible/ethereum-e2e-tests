import Web3 from "web3"
import {Contract} from "web3-eth-contract"
import {CryptoPunkOrder} from "@rarible/ethereum-api-client/build/models/Order"
import {toAddress} from "@rarible/types"
import {verifyEthBalance} from "../common/verify-eth-balance"
import {toBn} from "../common/to-bn"
import {expectEqual, expectLength} from "../common/expect-equal"
import {retry} from "../common/retry"
import {printLog, RETRY_ATTEMPTS, runLogging} from "./util"
import {
	ASSET_TYPE_ETH,
	ORDER_TYPE_CRYPTO_PUNK,
	punkIndex,
	ZERO_ADDRESS,
} from "./crypto-punks"
import {checkBidFields, getBidsForPunkByType} from "./common-bid"
import {getPunkMarketSellOrders} from "./punk-market-sell"

/**
 * Creates bid from [maker] in the punk market.
 */
export async function createPunkMarketBid(
	maker: string,
	price: number,
	web3: Web3,
	contract: Contract
): Promise<CryptoPunkOrder> {
	const balanceBefore = await web3.eth.getBalance(maker)
	await contract.methods.enterBidForPunk(punkIndex).send({from: maker, value: price})
	await verifyEthBalance(web3, toAddress(maker), toBn(balanceBefore).minus(price).toString())
	await checkPunkMarketBidExists(contract, maker, price)
	const bid = await retry(RETRY_ATTEMPTS, async () => {
		const cryptoPunkBids = await getPunkMarketBids(maker)
		expectLength(cryptoPunkBids, 1, "created punk market bids")
		return cryptoPunkBids[0]
	})
	printLog(`Created CRYPTO_PUNK bid: ${JSON.stringify(bid)}`)
	checkBidFields(bid, maker, ASSET_TYPE_ETH, price)
	return bid
}

export async function checkPunkMarketBidExists(contract: Contract, maker: string, price: number) {
	const rawBid = await contract.methods.punkBids(punkIndex).call()
	printLog(`Raw punk market bid: ${JSON.stringify(rawBid)}`)
	expectEqual(rawBid.hasBid, true, "rawBid.hasBid")
	expectEqual(rawBid.bidder.toLowerCase(), maker, "rawBid.bidder")
	expectEqual(rawBid.value, price.toString(), "rawBid.value")
	expectEqual(rawBid.punkIndex, punkIndex.toString(), "rawBid.punkIndex")
}

export async function checkApiPunkMarketBidExists(maker: string, price: number): Promise<CryptoPunkOrder> {
	return await retry(RETRY_ATTEMPTS, async () => {
		const bids = await getPunkMarketBids(maker)
		expectLength(bids, 1, `bid orders from ${maker}`)
		let bid = bids[0]
		expectEqual(bid.make.value, price.toString(), "API bid price")
		return bid
	})
}

export async function checkPunkMarketBidNotExists(
	contract: Contract,
) {
	const rawBid = await contract.methods.punkBids(punkIndex).call()
	expectEqual(rawBid.hasBid, false, "bid must not exist")
}

/**
 * Ensure the API does not return any CRYPTO_PUNK bids.
 */
export async function checkApiNoMarketBids(maker: string) {
	await runLogging(
		`ensure no punk market bids from ${maker} in API`,
		retry(RETRY_ATTEMPTS, async () => {
			const bids = await getPunkMarketBids(maker)
			expectLength(bids, 0, "punk bids count")
		})
	)
}

/**
 * Cancel native bids, if any. Ensure there are no native bids in the API response.
 */
export async function cancelBidsInPunkMarket(maker: string, contract: Contract, throwIfAnotherBidder: boolean = true) {
	const bid = await contract.methods.punkBids(punkIndex).call()
	const bidder = bid.bidder.toString().toLowerCase()
	if (bidder === ZERO_ADDRESS.toLowerCase()) {
		printLog(`No bids found in punk market from ${maker}`)
		return
	}
	if (bidder !== maker) {
		let message = `Bid is from another bidder ${bidder}`
		if (throwIfAnotherBidder) {
			throw new Error(message)
		}
		printLog(message)
	}
	await runLogging(
		`Cancelling raw bid from ${bidder}`,
		contract.methods.withdrawBidForPunk(punkIndex).send({ from: maker })
	)
	await checkApiNoMarketBids(maker)
}

/**
 * Request CRYPTO_PUNK bids from API.
 */
export async function getPunkMarketBids(maker: string | undefined): Promise<CryptoPunkOrder[]> {
	return await runLogging(
		`request CRYPTO_PUNK bids from API from ${maker}`,
		getBidsForPunkByType<CryptoPunkOrder>(maker, ORDER_TYPE_CRYPTO_PUNK)
	)
}
