import Web3 from "web3"
import {Contract} from "web3-eth-contract"
import {CryptoPunkOrder} from "@rarible/ethereum-api-client/build/models/Order"
import {toAddress} from "@rarible/types"
import {verifyEthBalance} from "../common/verify-eth-balance"
import {toBn} from "../common/to-bn"
import {retry} from "../common/retry"
import {checkFieldsOfBid, getApiPunkMarketBids} from "../common/api-bid"
import {ASSET_TYPE_ETH, printLog, RETRY_ATTEMPTS} from "../common/util"

/**
 * Creates bid from [maker] in the punk market.
 */
export async function createPunkMarketBid(
	maker: string,
	punkIndex: number,
	price: number,
	web3: Web3,
	contract: Contract
): Promise<CryptoPunkOrder> {
	const balanceBefore = await web3.eth.getBalance(maker)
	await contract.methods.enterBidForPunk(punkIndex).send({from: maker, value: price})
	await checkPunkMarketBidExists(punkIndex, maker, price, contract)
	await verifyEthBalance(web3, toAddress(maker), toBn(balanceBefore).minus(price).toString())
	const bid = await retry(RETRY_ATTEMPTS, async () => {
		const bids = await getApiPunkMarketBids(punkIndex, maker)
		expect(bids).toHaveLength(1)
		let bid = bids[0]
		checkFieldsOfBid(bid, maker, ASSET_TYPE_ETH, price)
		return bid
	})
	printLog(`Created CRYPTO_PUNK bid: ${JSON.stringify(bid)}`)
	return bid
}

export async function checkPunkMarketBidExists(
	punkIndex: number,
	maker: string,
	price: number,
	contract: Contract
) {
	const rawBid = await contract.methods.punkBids(punkIndex).call()
	printLog(`Raw punk market bid: ${JSON.stringify(rawBid)}`)
	expect(rawBid.hasBid).toBe(true)
	expect(rawBid.bidder.toLowerCase()).toBe(maker)
	expect(rawBid.value).toBe(price.toString())
	expect(rawBid.punkIndex).toBe(punkIndex.toString())
}

export async function checkPunkMarketBidNotExists(
	punkIndex: number,
	contract: Contract,
) {
	const rawBid = await contract.methods.punkBids(punkIndex).call()
	expect(rawBid.hasBid).toBe(false)
}
