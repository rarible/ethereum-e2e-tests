import { toAddress, toBigNumber } from "@rarible/types"
import { createRaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { Web3Ethereum } from "@rarible/web3-ethereum"
import { createErc1155V2Collection, createErc721V3Collection } from "@rarible/protocol-ethereum-sdk/build/common/mint"
import { RaribleV2Order } from "@rarible/ethereum-api-client"
import { verifyMinted } from "./common/verify-minted"
import { initProviders } from "./common/init-providers"
import { parseItemId } from "./common/parse-item-id"
import { verifyNewOwner } from "./common/verify-new-owner"
import { verifyEthBalance } from "./common/verify-eth-balance"
import { toBn } from "./common/to-bn"


describe("mint test", function () {

	const { web31, web32, wallet1, wallet2 } = initProviders({ pk2: "ded057615d97f0f1c751ea2795bc4b03bbf44844c13ab4f5e6fd976506c276b9" })

	const sdk1 = createRaribleSdk(new Web3Ethereum({ web3: web31 }), "e2e")
	const sdk2 = createRaribleSdk(new Web3Ethereum({ web3: web32 }), "e2e")

	const erc721Address = toAddress("0x22f8CE349A3338B15D7fEfc013FA7739F5ea2ff7")
	const erc1155Address = toAddress("0x268dF35c389Aa9e1ce0cd83CF8E5752b607dE90d")

	test("should lazy mint and sell ERC721 token", async () => {
		const mintResponse = await sdk1.nft.mint({
			collection: createErc721V3Collection(erc721Address),
			uri: "uri",
			creators: [{ account: toAddress(wallet1.getAddressString()), value: 10000 }],
			royalties: [],
			lazy: true,
		})
		await verifyMinted(sdk1, mintResponse.itemId)

		const { tokenId } = parseItemId(mintResponse.itemId)
		const order = await sdk1.order.sell({
			makeAssetType: {
				assetClass: "ERC721",
				contract: toAddress(erc721Address),
				tokenId: toBigNumber(tokenId),
			},
			amount: 1,
			maker: toAddress(wallet1.getAddressString()),
			originFees: [],
			payouts: [],
			price: 1000000,
			takeAssetType: { assetClass: "ETH" },
		}) as RaribleV2Order

		const balanceBefore = await web32.eth.getBalance(wallet2.getAddressString())
		await sdk2.order.fill({
			order,
			originFee: 0,
			amount: 1,
			infinite: true,
		})

		await verifyNewOwner(sdk2, mintResponse.itemId, toAddress(wallet2.getAddressString()))
		await verifyEthBalance(web32, toAddress(wallet2.getAddressString()), toBn(balanceBefore).minus(1000000).toString())

	}, 50000)

	test("should lazy mint and sell ERC1155 token", async () => {
		const mintResponse = await sdk1.nft.mint({
			collection: createErc1155V2Collection(erc1155Address),
			uri: "//testUri",
			supply: 100,
			creators: [{ account: toAddress(wallet1.getAddressString()), value: 10000 }],
			royalties: [],
			lazy: true,

		})
		await verifyMinted(sdk1, mintResponse.itemId)

		const { tokenId } = parseItemId(mintResponse.itemId)
		const order = await sdk1.order.sell({
			makeAssetType: {
				assetClass: "ERC1155",
				contract: toAddress(erc1155Address),
				tokenId: toBigNumber(tokenId),
			},
			amount: 1,
			maker: toAddress(wallet1.getAddressString()),
			originFees: [],
			payouts: [],
			price: 1000000,
			takeAssetType: { assetClass: "ETH" },
		}) as RaribleV2Order

		const balanceBefore = await web32.eth.getBalance(wallet2.getAddressString())
		await sdk2.order.fill({
			order,
			originFee: 0,
			amount: 1,
			infinite: true,
		})

		await verifyNewOwner(sdk2, mintResponse.itemId, toAddress(wallet2.getAddressString()))
		await verifyEthBalance(web32, toAddress(wallet2.getAddressString()), toBn(balanceBefore).minus(1000000).toString())

	}, 50000)


})
