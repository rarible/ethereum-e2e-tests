import { createRaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { toAddress, toBigNumber } from "@rarible/types"
import { Web3Ethereum } from "@rarible/web3-ethereum"
import { createErc1155EthereumContract, deployTestErc1155, erc1155Mint } from "../contracts/test-erc1155"
import { awaitAll } from "../common/await-all"
import { initProviders } from "../common/init-providers"
import { verifyAuctionStatus } from "../common/auction-helper"
import { deployTestErc20, erc20Mint } from "../contracts/test-erc20"
import { verifyErc1155Balance } from "../common/verify-erc1155-balance"
import { verifyEthBalance } from "../common/verify-eth-balance"
import { toBn } from "../common/to-bn"
import { AuctionStatus } from "@rarible/ethereum-api-client"
import { verifyErc20Balance } from "../common/verify-erc20-balance"


describe("erc-1155 buy out auction test", function () {
	const { web31: web3Seller, web32: web3Buyer, wallet1: walletSeller, wallet2: walletBuyer } = initProviders({pk2: "ded057615d97f0f1c751ea2795bc4b03bbf44844c13ab4f5e6fd976506c276b9"})
	const ethereumSeller = new Web3Ethereum({ web3: web3Seller , gas: 8000000})

	const sellerSdk = createRaribleSdk(ethereumSeller, "e2e")
	const buyerSdk = createRaribleSdk(new Web3Ethereum({ web3: web3Buyer }), "e2e")

	const conf = awaitAll({
		sellerContractErc20: deployTestErc20(web3Seller),
		sellerContractErc1155: deployTestErc1155(web3Seller),
	})

	test("buy out erc-1155 <-> eth", async () => {
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

		const buyerEthBalanceBefore = await web3Buyer.eth.getBalance(walletBuyer.getAddressString())
		const sellerEthBalanceBefore = await web3Seller.eth.getBalance(walletSeller.getAddressString())
		const buyOut = await buyerSdk.auction.buyOut({
			auctionId: await auction.auctionId,
			payouts: [],
			originFees: [],
		})
		await buyOut.wait()

		await verifyErc1155Balance(conf.sellerContractErc1155, walletBuyer.getAddressString(), "1", "1")
		await verifyEthBalance(web3Buyer, toAddress(walletBuyer.getAddressString()), toBn(buyerEthBalanceBefore).minus(200).toString())
		await verifyEthBalance(web3Seller, toAddress(walletSeller.getAddressString()), toBn(sellerEthBalanceBefore).plus(200).toString())
		await verifyAuctionStatus(sellerSdk, auction, AuctionStatus.FINISHED)
	})

	test("buy out auction erc-1155 <-> erc-20", async () => {
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

		const buyOut = await buyerSdk.auction.buyOut({
			auctionId: await auction.auctionId,
			payouts: [],
			originFees: [],
		})
		await buyOut.wait()

		await verifyErc1155Balance(conf.sellerContractErc1155, walletBuyer.getAddressString(), "2", "1")
		await verifyErc20Balance(conf.sellerContractErc20, walletSeller.getAddressString(), 100)
		await verifyErc20Balance(conf.sellerContractErc20, walletBuyer.getAddressString(), 400)
		await verifyAuctionStatus(sellerSdk, auction, AuctionStatus.FINISHED)
	})

})
