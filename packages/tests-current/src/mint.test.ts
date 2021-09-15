import { toAddress, toBigNumber } from "@rarible/types"
import { createRaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { Web3Ethereum } from "@rarible/web3-ethereum"
import { verifyMinted } from "./common/verify-minted"
import { initProvider } from "./common/init-providers"

describe("mint test", function () {
	const { web3, wallet } = initProvider()

	const sdk = createRaribleSdk(new Web3Ethereum({ web3: web3 }), "e2e")

	const erc721Address = toAddress("0x22f8CE349A3338B15D7fEfc013FA7739F5ea2ff7")
	const erc1155Address = toAddress("0x268dF35c389Aa9e1ce0cd83CF8E5752b607dE90d")

	test("should mint ERC721 token", async () => {

		const itemId = await sdk.nft.mint({
			collection: {
				type: "ERC721",
				id: erc721Address,
				supportsLazyMint: true,
			},
			uri: '//testUri',
			creators: [{ account: toAddress(wallet.getAddressString()), value: 10000 }],
			royalties: [],
		})
		await verifyMinted(sdk, itemId)

	}, 50000)

	test("should mint ERC1155 token", async () => {

		const itemId = await sdk.nft.mint({
			collection: {
				type: "ERC1155",
				id: erc1155Address,
				supportsLazyMint: true,
			},
			uri: '//testUri',
			creators: [{ account: toAddress(wallet.getAddressString()), value: 10000 }],
			royalties: [],
			supply: toBigNumber('100'),
		})
		await verifyMinted(sdk, itemId)
	})
})
