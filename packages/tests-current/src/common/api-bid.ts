import {EthAssetType, Platform, RaribleV2Order} from "@rarible/ethereum-api-client"
import {CryptoPunkOrder, Order} from "@rarible/ethereum-api-client/build/models/Order"
import {CryptoPunksAssetType, Erc20AssetType} from "@rarible/ethereum-api-client/build/models"
import {RaribleSdk} from "@rarible/protocol-ethereum-sdk"
import {BidRequest} from "@rarible/protocol-ethereum-sdk/build/order/bid"
import {toAddress} from "@rarible/types"
import {
	AssetType,
	Erc1155AssetType,
	Erc1155LazyAssetType,
	Erc721AssetType,
	Erc721LazyAssetType,
} from "@rarible/ethereum-api-client/build/models/AssetType"
import {cryptoPunksAddress} from "../contracts/crypto-punks"
import {apiSdk, printLog, RETRY_ATTEMPTS, runLogging} from "./util"
import {toBn} from "./to-bn"
import {retry} from "./retry"

export function checkFieldsOfBid(
	bid: RaribleV2Order | CryptoPunkOrder,
	maker: string,
	makeAssetType: EthAssetType | Erc20AssetType,
	price: number,
	taker: string | undefined = undefined
) {
	expect(bid.make.assetType).toStrictEqual(makeAssetType)
	expect(toBn(bid.make.value)).toStrictEqual(toBn(price))
	expect(bid.maker).toBe(maker)

	expect(bid.taker).toBe(taker)
	expect(bid.take.valueDecimal).toBe(1)
}

export async function getApiRaribleBids(
	contract: string,
	tokenId: string,
	maker: string | undefined
): Promise<RaribleV2Order[]> {
	return await getApiBids(contract, tokenId, maker, "RARIBLE_V2")
}

export async function getApiPunkMarketBids(
	punkIndex: number,
	maker: string | undefined
): Promise<CryptoPunkOrder[]> {
	return getApiBids(cryptoPunksAddress, punkIndex.toString(), maker, "CRYPTO_PUNK")
}

/**
 * Requests API bids on token ({@param contract}:{@param tokenId}) with maker {@param maker}
 * having type {@param type}.
 */
async function getApiBids<T extends Order>(
	contract: string,
	tokenId: string,
	maker: string | undefined,
	type: "RARIBLE_V2" | "CRYPTO_PUNK" | undefined
): Promise<T[]> {
	const bids = await runLogging(
		`request ${type} bids for ${contract}:${tokenId} from API with maker = ${maker}`,
		apiSdk.apis.order.getOrderBidsByItem({
			contract: contract,
			tokenId: tokenId,
			platform: Platform.ALL,
			maker: maker,
		})
	)
	return bids.orders
		.filter(a => type === undefined || a["type"] === type)
		.map(o => o as T)
}

/**
 * Creates RaribleV2 bid order with specified values.
 */
export async function createRaribleBidOrder(
	maker: string,
	price: number,
	makeAssetType: Erc20AssetType,
	takeAssetType: CryptoPunksAssetType,
	sdk: RaribleSdk
) {
	let newVar: BidRequest = {
		makeAssetType: makeAssetType,
		amount: 1,
		maker: toAddress(maker),
		originFees: [],
		payouts: [],
		price: price,
		takeAssetType: takeAssetType,
	}
	let raribleBid = await runLogging(
		`create ERC20 Rarible bid order with price ${price}`,
		sdk.order.bid(newVar).then((order) => order as RaribleV2Order)
	)
	printLog(`Created RaribleV2 bid order: ${JSON.stringify(raribleBid)}`)
	checkFieldsOfBid(raribleBid, maker, makeAssetType, price)
	await checkApiBidExists(raribleBid)
	return raribleBid
}

/**
 * Ensure the API does not return any bids for {@param contract}:${@param tokenId} and {@param maker}
 */
export async function checkApiNoBids(
	contract: string,
	tokenId: string,
	maker: string | undefined
) {
	await runLogging(
		`ensure no bids for ${contract}:${tokenId} in API with maker ${maker}`,
		retry(RETRY_ATTEMPTS, async () => {
			const bids = await getApiBids<Order>(contract, tokenId, maker, undefined)
			expect(bids).toHaveLength(0)
		})
	)
}

/**
 * Ensure the API returns the expected bid.
 */
export async function checkApiBidExists(bid: RaribleV2Order | CryptoPunkOrder) {
	let takeAssetType = bid.take.assetType
	if (hasContractAndTokenId(takeAssetType)) {
		let contract = takeAssetType.contract
		let tokenId = takeAssetType.tokenId.toString()
		await runLogging(
			`Check bid order exists in API ${JSON.stringify(bid)}`,
			retry(RETRY_ATTEMPTS, async () => {
				const bids = await getApiBids(contract, tokenId, bid.maker, undefined)
				expect(bids).toContainEqual(bid)
			})
		)
	}
}

export type AssetTypeWithContractAndTokenId = Erc721AssetType | Erc1155AssetType
| Erc721LazyAssetType | Erc1155LazyAssetType | CryptoPunksAssetType

export function hasContractAndTokenId(assetType: AssetType): assetType is AssetTypeWithContractAndTokenId  {
	return "contract" in assetType && "tokenId" in assetType
}
