import {RaribleSdk} from "@rarible/protocol-ethereum-sdk"
import Web3 from "web3"
import {Contract} from "web3-eth-contract"
import {CryptoPunkOrder} from "@rarible/ethereum-api-client/build/models/Order"
import {toAddress} from "@rarible/types"
import {verifyEthBalance} from "../common/verify-eth-balance"
import {toBn} from "../common/to-bn"
import {expectEqual, expectLength} from "../common/expect-equal"
import {retry} from "../common/retry"
import {printLog, runLogging} from "./util"
import {
	ASSET_TYPE_ETH,
	ORDER_TYPE_CRYPTO_PUNK,
	punkIndex,
	ZERO_ADDRESS,
} from "./crypto-punks"
import {checkBidFields, getBidsForPunkByType, getInactiveBidsForPunkByType} from "./common-bid"

/**
 * Creates bid from [maker] in the punk market.
 */
export async function createPunkMarketBid(
	price: number,
	maker: string,
	sdk: RaribleSdk,
	web3: Web3,
	contract: Contract
): Promise<CryptoPunkOrder> {
	const balanceBefore = await web3.eth.getBalance(maker)
	await contract.methods.enterBidForPunk(punkIndex).send({from: maker, value: price})
	await verifyEthBalance(web3, toAddress(maker), toBn(balanceBefore).minus(price).toString())
	const rawBid = await contract.methods.punkBids(punkIndex).call()
	printLog(`Raw punk market bid: ${JSON.stringify(rawBid)}`)
	expectEqual(rawBid.hasBid, true, "rawBid.hasBid")
	expectEqual(rawBid.bidder.toLowerCase(), maker, "rawBid.bidder")
	expectEqual(rawBid.value, price.toString(), "rawBid.value")
	expectEqual(rawBid.punkIndex, punkIndex.toString(), "rawBid.punkIndex")
	const bid = await retry(3, async () => {
		const cryptoPunkBids = await getPunkMarketBids(maker, sdk)
		expectLength(cryptoPunkBids, 1, "created punk market bids")
		return cryptoPunkBids[0]
	})
	printLog(`Created CRYPTO_PUNK bid: ${JSON.stringify(bid)}`)
	checkBidFields(bid, ASSET_TYPE_ETH, price, maker)
	return bid
}

/**
 * Ensure the API does not return any CRYPTO_PUNK bids.
 */
export async function checkApiNoMarketBids(sdk: RaribleSdk) {
	await runLogging(
		"ensure no punk market bids in API",
		retry(3, async () => {
			const bids = await getPunkMarketBids(undefined, sdk)
			expectLength(bids, 0, "punk bids count")
		})
	)
}

/**
 * Cancel native bids, if any. Ensure there are no native bids in the API response.
 */
export async function cancelBidsInPunkMarket(sdk: RaribleSdk, maker: string, contract: Contract) {
	const bid = await contract.methods.punkBids(punkIndex).call()
	const bidder = bid.bidder.toString().toLowerCase()
	if (bidder === ZERO_ADDRESS.toLowerCase()) {
		printLog("No bids found in punk market")
		return
	}
	if (bidder !== maker) {
		printLog(`Bid is from another bidder ${bidder}`)
		return
	}
	printLog(`Found bid in punk market from ${bidder}, cancelling it`)
	await contract.methods.withdrawBidForPunk(punkIndex).send({from: bidder})
	await checkApiNoMarketBids(sdk)
}

/**
 * Request INACTIVE CRYPTO_PUNK bids from API.
 */
export async function getInactivePunkMarketBids(sdk: RaribleSdk, maker: string): Promise<CryptoPunkOrder[]> {
	return getInactiveBidsForPunkByType<CryptoPunkOrder>(sdk, maker, ORDER_TYPE_CRYPTO_PUNK)
}

/**
 * Request CRYPTO_PUNK bids from API.
 */
export async function getPunkMarketBids(maker: string | undefined, sdk: RaribleSdk): Promise<CryptoPunkOrder[]> {
	return await runLogging(
		"request CRYPTO_PUNK bids from API",
		getBidsForPunkByType<CryptoPunkOrder>(sdk, ORDER_TYPE_CRYPTO_PUNK, maker)
	)
}
