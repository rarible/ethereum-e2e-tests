import { createRaribleSdk } from "@rarible/protocol-ethereum-sdk"
import fetch from "node-fetch"
import { toAddress, toBigNumber } from "@rarible/types"
import { Web3Ethereum } from "@rarible/web3-ethereum"
import { createE2eProvider } from "./common/create-e2e-provider"
import { verifyNewOwner } from "./common/verify-new-owner"
import { verifyEthBalance } from "./common/verify-eth-balance"
import { toBn } from "./common/to-bn"

describe("test buy erc721 for eth", function () {
	const { web3: web31, wallet: wallet1 } = createE2eProvider()
	const {
		web3: web32,
		wallet: wallet2,
	} = createE2eProvider("ded057615d97f0f1c751ea2795bc4b03bbf44844c13ab4f5e6fd976506c276b9")

	const sdk1 = createRaribleSdk(new Web3Ethereum({ web3: web31 }), "e2e", { fetchApi: fetch })
	const sdk2 = createRaribleSdk(new Web3Ethereum({ web3: web32 }), "e2e", { fetchApi: fetch })

	const erc721Address = toAddress("0x22f8CE349A3338B15D7fEfc013FA7739F5ea2ff7")

	test("test buy erc721 for eth", async () => {
		const tokenId = await sdk1.nft.mint({
			collection: {
				type: "ERC721",
				id: erc721Address,
				supportsLazyMint: true,
			},
			uri: '//testUri',
			creators: [{ account: toAddress(wallet1.getAddressString()), value: 10000 }],
			royalties: [],
		})

		const order = await sdk1.order.sell({
			makeAssetType: {
				assetClass: "ERC721",
				contract: toAddress(erc721Address),
				tokenId: toBigNumber(tokenId as string),
			},
			amount: 1,
			maker: toAddress(wallet1.getAddressString()),
			originFees: [],
			payouts: [],
			price: 1000000,
			takeAssetType: { assetClass: "ETH" },

		}).then(a => a.build().runAll())

		const balanceBefore = await web32.eth.getBalance(wallet2.getAddressString())
		await sdk2.order.fill(order, {
			payouts: [],
			originFees: [],
			amount: 1,
		}).then(a => a.build().runAll())

		await verifyNewOwner(sdk2, tokenId as string, toAddress(wallet2.getAddressString()))
		await verifyEthBalance(web32, toAddress(wallet2.getAddressString()), toBn(balanceBefore).minus(1000000).toString())
	}, 30000)
})
