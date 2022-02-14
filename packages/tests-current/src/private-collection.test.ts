import { createRaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { randomAddress, toAddress } from "@rarible/types"
import { Web3Ethereum } from "@rarible/web3-ethereum"
import { Address } from "@rarible/ethereum-api-client"
import { createErc721V3Collection } from "@rarible/protocol-ethereum-sdk/build/common/mint"
import { initProvider } from "./common/init-providers"
import { verifyMinted } from "./common/verify-minted"

describe("Private collection", function () {
	const { web3, wallet } = initProvider()
	const sdk = createRaribleSdk(new Web3Ethereum({ web3 }), "e2e")

	let address: Address
	beforeAll(async () => {
		({ address } = await sdk.nft.deploy.erc721.deployUserToken(
			"test",
			"test",
			"ipfs://testUri",
			"ipfs://testUri",
			[]
		))
	})

	test("should mint by owner - lazy", async () => {
		const mintResponse = await sdk.nft.mint({
			collection: createErc721V3Collection(address),
			uri: "ipfs://testUri",
			creators: [{ account: toAddress(wallet.getAddressString()), value: 10000 }],
			royalties: [],
			lazy: true,
		})
		await verifyMinted(sdk, mintResponse.itemId)
	})

	test("should not mint by anyone else - lazy", async () => {
		await expect(sdk.nft.mint({
			collection: createErc721V3Collection(address),
			uri: "ipfs://testUri",
			creators: [{account: randomAddress(), value: 10000}],
			royalties: [],
			lazy: true,
		})).rejects.toEqual({status: 500, value: {}})
	})

	test("should mint by owner", async () => {
		const mintResponse = await sdk.nft.mint({
			collection: createErc721V3Collection(address),
			uri: "ipfs://testUri",
			creators: [{ account: toAddress(wallet.getAddressString()), value: 10000 }],
			royalties: [],
			lazy: false,
		})
		await verifyMinted(sdk, mintResponse.itemId)
	})

	test.skip("should not mint by anyone else", async () => {
		await expect(async () => {
			return sdk.nft.mint({
				collection: createErc721V3Collection(address),
				uri: "ipfs://testUri",
				creators: [{ account: randomAddress(), value: 10000 }],
				royalties: [],
				lazy: false,
			})
		}).rejects.toThrow(new Error("The execution failed due to an exception.\nReverted"))
	})
})
