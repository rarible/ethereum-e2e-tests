import { toAddress, toBigNumber } from "@rarible/types"
import { createRaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { Web3Ethereum } from "@rarible/web3-ethereum"
import { verifyErc721Burned } from "./common/verify-erc-721-burned"
import { createMintableTokenContract } from "./contracts/mintable-token"
import { createRaribleTokenContract } from "./contracts/rarible-token"
import { verifyErc1155Burned } from "./common/verify-erc1155-burned"
import { initProvider } from "./common/init-providers"
import { parseItemId } from "./common/parse-item-id"

describe("burn test", function () {
	const { web3, wallet } = initProvider()
	const ethereum = new Web3Ethereum({ web3: web3 })

	const testAddress = toAddress(wallet.getAddressString())

	const sdk = createRaribleSdk(ethereum, "e2e")


	test("should burn ERC721 token", async () => {
		const erc721Address = toAddress("0x87ECcc03BaBC550c919Ad61187Ab597E9E7f7C21")
		const testErc721 = createMintableTokenContract(ethereum, erc721Address)
		const itemId = await sdk.nft.mint({
			collection: {
				type: "ERC721",
				id: erc721Address,
				supportsLazyMint: false,
			},
			uri: '//testUri',
			royalties: [],
		})

		const { tokenId } = parseItemId(itemId)
		await sdk.nft.burn({ assetClass: "ERC721", contract: erc721Address, tokenId: toBigNumber(tokenId) })

		await verifyErc721Burned(testErc721, testAddress)
	}, 50000)

	test("should burn ERC1155 token", async () => {
		const erc1155Address = toAddress("0x8812cFb55853da0968a02AaaEA84CD93EC4b42A1")
		const testErc1155 = createRaribleTokenContract(ethereum, erc1155Address)

		const itemId = await sdk.nft.mint({
			collection: {
				type: "ERC1155",
				id: erc1155Address,
				supportsLazyMint: false,
			},
			uri: '//testUri',
			royalties: [],
			supply: 10,
		})

		const { tokenId } = parseItemId(itemId)
		await sdk.nft.burn({ assetClass: "ERC1155", contract: erc1155Address, tokenId: toBigNumber(tokenId) }, 5)
		await verifyErc1155Burned(testErc1155, testAddress, tokenId, 5)
	})
})
