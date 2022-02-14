import { createRaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { toAddress, toBigNumber } from "@rarible/types"
import { Web3Ethereum } from "@rarible/web3-ethereum"
import { createErc1155EthereumContract, deployTestErc1155, erc1155Mint } from "../contracts/test-erc1155"
import { awaitAll } from "../common/await-all"
import { initProviders } from "../common/init-providers"
import { verifyAuctionStatus } from "../common/auction-helper"
import { deployTestErc20 } from "../contracts/test-erc20"
import { AuctionStatus } from "@rarible/ethereum-api-client"


describe("start auction test", function () {
	const { web31: web3Seller, web32: web3Buyer, wallet1: walletSeller, wallet2: walletBuyer } = initProviders({pk2: "ded057615d97f0f1c751ea2795bc4b03bbf44844c13ab4f5e6fd976506c276b9"})
	const ethereumSeller = new Web3Ethereum({ web3: web3Seller , gas: 8000000})

	const sellerSdk = createRaribleSdk(ethereumSeller, "e2e")
	const buyerSdk = createRaribleSdk(new Web3Ethereum({ web3: web3Buyer }), "e2e")

	const conf = awaitAll({
		sellerContractErc20: deployTestErc20(web3Seller),
		sellerContractErc1155: deployTestErc1155(web3Seller),
	})

	test("start auction test", async () => {
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
	})
})
