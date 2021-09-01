import fetch from "node-fetch"
import { toAddress, toBigNumber } from "@rarible/types"
import { createRaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { Web3Ethereum } from "@rarible/web3-ethereum"
import { createE2eProvider } from "./common/create-e2e-provider"
import { verifyErc721Burned } from "./common/verify-erc-721-burned"
import { createMintableTokenContract } from "./contracts/mintable-token"
import { createRaribleTokenContract } from "./contracts/rarible-token"
import { verifyErc1155Burned } from "./common/verify-erc1155-burned"

describe("burn test", function () {
	const { web3, wallet } = createE2eProvider()
	const ethereum = new Web3Ethereum({ web3: web3 })

	const testAddress = toAddress(wallet.getAddressString())

	const sdk = createRaribleSdk(ethereum, "e2e", { fetchApi: fetch })


	test("should burn ERC721 token", async () => {
		const erc721Address = toAddress("0x87ECcc03BaBC550c919Ad61187Ab597E9E7f7C21")
		const testErc721 = createMintableTokenContract(ethereum, erc721Address)
		const tokenId = await sdk.nft.mint({
			collection: {
				type: "ERC721",
				id: erc721Address,
				supportsLazyMint: false,
			},
			uri: '//testUri',
			royalties: [],
		})

		await sdk.nft.burn({ assetClass: "ERC721", contract: erc721Address, tokenId: toBigNumber(tokenId as string) })

		await verifyErc721Burned(testErc721, testAddress)
	}, 50000)

	test("should burn ERC1155 token", async () => {
		const erc1155Address = toAddress("0x8812cFb55853da0968a02AaaEA84CD93EC4b42A1")
		const testErc1155 = createRaribleTokenContract(ethereum, erc1155Address)

		const tokenId = await sdk.nft.mint({
			collection: {
				type: "ERC1155",
				id: erc1155Address,
				supportsLazyMint: false,
			},
			uri: '//testUri',
			royalties: [],
			supply: 10,
		})

		await sdk.nft.burn({ assetClass: "ERC1155", contract: erc1155Address, tokenId: toBigNumber(tokenId as string) }, 5)

		await verifyErc1155Burned(testErc1155, testAddress, tokenId as string, 5)
	}, 50000)
})
