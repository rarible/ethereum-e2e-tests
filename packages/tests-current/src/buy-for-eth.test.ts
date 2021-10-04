import { createRaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { toAddress, toBigNumber } from "@rarible/types"
import { Web3Ethereum } from "@rarible/web3-ethereum"
import { ERC721VersionEnum } from "@rarible/protocol-ethereum-sdk/build/nft/contracts/domain"
import { RaribleV2OrderFillRequest } from "@rarible/protocol-ethereum-sdk/build/order/fill-order"
import { verifyNewOwner } from "./common/verify-new-owner"
import { verifyEthBalance } from "./common/verify-eth-balance"
import { toBn } from "./common/to-bn"
import { initProviders } from "./common/init-providers"
import { parseItemId } from "./common/parse-item-id"

describe("test buy erc721 for eth", function () {
	const { web31, web32, wallet1, wallet2 } = initProviders({ pk2: "ded057615d97f0f1c751ea2795bc4b03bbf44844c13ab4f5e6fd976506c276b9" })

	const sdk1 = createRaribleSdk(new Web3Ethereum({ web3: web31 }), "e2e")
	const sdk2 = createRaribleSdk(new Web3Ethereum({ web3: web32 }), "e2e")

	const erc721Address = toAddress("0x22f8CE349A3338B15D7fEfc013FA7739F5ea2ff7")

	test("test buy erc721 for eth", async () => {
		const mintResponse = await sdk1.nft.mint({
			collection: {
				features: ["SECONDARY_SALE_FEES", "MINT_AND_TRANSFER"],
				id: erc721Address,
				name: "Test-collection",
				type: "ERC721",
				supportsLazyMint: true,
				version: ERC721VersionEnum.ERC721V3,
			},
			uri: '//testUri',
			creators: [{ account: toAddress(wallet1.getAddressString()), value: 10000 }],
			royalties: [],
			lazy: false
		})

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

		}).then(a => a.build().runAll())

		const balanceBefore = await web32.eth.getBalance(wallet2.getAddressString())
		await sdk2.order.fill({
			order,
			originFee: 0,
			amount: 1,
			infinite: true
		} as RaribleV2OrderFillRequest).then(a => a.build().runAll())

		await verifyNewOwner(sdk2, mintResponse.itemId, toAddress(wallet2.getAddressString()))
		await verifyEthBalance(web32, toAddress(wallet2.getAddressString()), toBn(balanceBefore).minus(1000000).toString())
	})
})
