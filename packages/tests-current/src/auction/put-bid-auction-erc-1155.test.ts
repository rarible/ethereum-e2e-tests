import { createRaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { toAddress, toBigNumber } from "@rarible/types"
import { Web3Ethereum } from "@rarible/web3-ethereum"
import { createErc1155EthereumContract, deployTestErc1155, erc1155Mint } from "../contracts/test-erc1155"
import { awaitAll } from "../common/await-all"
import { initProviders } from "../common/init-providers"
import { deployTestErc20, erc20Mint } from "../contracts/test-erc20"
import { verifyAuctionStatus } from "../common/auction-helper"
import { AuctionStatus } from "@rarible/ethereum-api-client"


describe("put bid auction test", function () {
	const { web31: web3Seller, web32: web3Buyer, wallet1: walletSeller, wallet2: walletBuyer } = initProviders({pk2: "ded057615d97f0f1c751ea2795bc4b03bbf44844c13ab4f5e6fd976506c276b9"})
	const ethereumSeller = new Web3Ethereum({ web3: web3Seller , gas: 8000000})

	const sellerSdk = createRaribleSdk(ethereumSeller, "e2e")
	const buyerSdk = createRaribleSdk(new Web3Ethereum({ web3: web3Buyer }), "e2e")

	const conf = awaitAll({
		sellerContractErc20: deployTestErc20(web3Seller),
		sellerContractErc1155: deployTestErc1155(web3Seller),
	})

	test("put bid erc-1155 <-> eth", async () => {
		const erc1155Contract = createErc1155EthereumContract(ethereumSeller, toAddress(conf.sellerContractErc1155.options.address))
		const mintTx = await erc1155Mint(erc1155Contract, walletSeller.getAddressString(), walletSeller.getAddressString(), "1", 100)
		await mintTx.wait()

		const auction = await sellerSdk.auction.start(
			{
				makeAssetType: {
					assetClass: "ERC1155",
					contract: toAddress(conf.sellerContractErc1155.options.address),
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

	test("put bid erc-1155 <-> erc-20", async () => {
		const erc1155Contract = createErc1155EthereumContract(ethereumSeller, toAddress(conf.sellerContractErc1155.options.address))
		const mint1155Tx = await erc1155Mint(erc1155Contract, walletSeller.getAddressString(), walletSeller.getAddressString(), "2", 100)
		await mint1155Tx.wait()
		await erc20Mint(conf.sellerContractErc20, walletSeller.getAddressString(), walletBuyer.getAddressString(), 500)

		const auction = await sellerSdk.auction.start(
			{
				makeAssetType: {
					assetClass: "ERC1155",
					contract: toAddress(conf.sellerContractErc1155.options.address),
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
