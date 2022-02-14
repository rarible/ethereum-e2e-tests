import { createRaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { toAddress, toBigNumber } from "@rarible/types"
import { Web3Ethereum } from "@rarible/web3-ethereum"
import { awaitAll } from "../common/await-all"
import { initProviders } from "../common/init-providers"
import { verifyAuctionStatus } from "../common/auction-helper"
import { deployTestErc20, erc20Mint } from "../contracts/test-erc20"
import { AuctionStatus } from "@rarible/ethereum-api-client"
import { deployTestErc721, erc721Mint } from "../contracts/test-erc721"


describe("erc-721 buy out auction test", function () {
	const { web31: web3Seller, web32: web3Buyer, wallet1: walletSeller, wallet2: walletBuyer } = initProviders({pk2: "ded057615d97f0f1c751ea2795bc4b03bbf44844c13ab4f5e6fd976506c276b9"})
	const ethereumSeller = new Web3Ethereum({ web3: web3Seller , gas: 8000000})

	const sellerSdk = createRaribleSdk(ethereumSeller, "e2e")
	const buyerSdk = createRaribleSdk(new Web3Ethereum({ web3: web3Buyer }), "e2e")

	const conf = awaitAll({
		sellerContractErc20: deployTestErc20(web3Seller),
		sellerContractErc721: deployTestErc721(web3Seller),
	})

	test("put bid erc-721 <-> eth", async () => {
		await erc721Mint(conf.sellerContractErc721, walletSeller.getAddressString(), walletSeller.getAddressString(), 1)

		const auction = await sellerSdk.auction.start(
			{
				makeAssetType: {
					assetClass: "ERC721",
					contract: toAddress(conf.sellerContractErc721.options.address),
					tokenId: toBigNumber("1"),
				},
				amount: toBigNumber("1"),
				takeAssetType: {
					assetClass: "ETH",
				},
				minimalStepDecimal: toBigNumber("0.00000000000000001"),
				minimalPriceDecimal: toBigNumber("0.00000000000000005"),
				duration: 1000,
				startTime: 0,
				buyOutPriceDecimal: toBigNumber("0.0000000000000002"),
				originFees: [],
				payouts: [],
			}
		)
		await auction.tx.wait()
		await verifyAuctionStatus(sellerSdk, auction, AuctionStatus.ACTIVE)

		const putBid = await buyerSdk.auction.putBid({
			auctionId: await auction.auctionId,
			priceDecimal: toBigNumber("0.00000000000000005"),
			payouts: [],
			originFees: [],
		})
		await putBid.wait()
	})

	test("put bid erc-721 <-> erc-20", async () => {
		await erc721Mint(conf.sellerContractErc721, walletSeller.getAddressString(), walletSeller.getAddressString(), 2)
		await erc20Mint(conf.sellerContractErc20, walletSeller.getAddressString(), walletBuyer.getAddressString(), 500)

		const auction = await sellerSdk.auction.start(
			{
				makeAssetType: {
					assetClass: "ERC721",
					contract: toAddress(conf.sellerContractErc721.options.address),
					tokenId: toBigNumber("2"),
				},
				amount: toBigNumber("1"),
				takeAssetType: {
					assetClass: "ERC20",
					contract: toAddress(conf.sellerContractErc20.options.address),
				},
				minimalStepDecimal: toBigNumber("0.00000000000000001"),
				minimalPriceDecimal: toBigNumber("0.00000000000000005"),
				duration: 1000,
				startTime: 0,
				buyOutPriceDecimal: toBigNumber("0.0000000000000001"),
				originFees: [],
				payouts: [],
			}
		)
		await auction.tx.wait()
		await verifyAuctionStatus(sellerSdk, auction, AuctionStatus.ACTIVE)

		const putBid = await buyerSdk.auction.putBid({
			auctionId: await auction.auctionId,
			priceDecimal: toBigNumber("0.00000000000000005"),
			payouts: [],
			originFees: [],
		})
		await putBid.wait()
	})
})

