
import {awaitAll} from "@rarible/ethereum-sdk-test-common/build/await-all"
import {randomAddress, toAddress} from "@rarible/types"
import {createRaribleSdk} from "@rarible/protocol-ethereum-sdk"
import {Web3Ethereum} from "@rarible/web3-ethereum"
import {Address, NftCollectionControllerApi} from "@rarible/ethereum-api-client"
import {deployTestErc721Rarible} from "./contracts/test-erc721-rarible"
import {deployTestErc721Ownable} from "./contracts/test-erc721-ownable"
import {deployTestErc1155} from "./contracts/test-erc1155-rarible"
import {initProviders} from "./common/init-providers"
import {retry} from "./common/retry"
import {erc721MintOwnable} from "./contracts/test-erc721-ownable"

describe("transfer token ownership", function () {
	const { web31, wallet1 } = initProviders({})

	const conf = awaitAll({
		testErc721Ownable: deployTestErc721Ownable(web31),
		testErc721: deployTestErc721Rarible(web31),
		testErc1155: deployTestErc1155(web31),
	})

	const sdk = createRaribleSdk(new Web3Ethereum({web3: web31}), "e2e")

	test("transfer ownership of ERC721Rarible", async () => {
		let collection = conf.testErc721.options.address
		console.log("Collection", collection)
		let owner = await conf.testErc721.methods.owner().call()
		let initialOwner = toAddress(wallet1.getAddressString())
		console.log("Initial owner", wallet1.getAddressString())
		expect(toAddress(owner)).toBe(initialOwner)
		await awaitOwnerToBe(sdk.apis.nftCollection, collection, initialOwner)
		await awaitMinterToBe(sdk.apis.nftCollection, collection, [initialOwner])
		let newOwner = randomAddress()
		console.log("New expected owner", wallet1.getAddressString())
		await conf.testErc721.methods.transferOwnership(newOwner).send({from: initialOwner})
		await awaitOwnerToBe(sdk.apis.nftCollection, collection, newOwner)
		await awaitMinterToBe(sdk.apis.nftCollection, collection, [newOwner])
	}, 30000)

	test("test-erc1155 transfer", async () => {
		let collection = conf.testErc1155.options.address
		console.log("Collection", collection)
		let owner = await conf.testErc1155.methods.owner().call()
		console.log("initial owner is" + owner)
		let initialOwner = toAddress(wallet1.getAddressString())
		console.log("Initial owner", wallet1.getAddressString())
		expect(toAddress(owner)).toBe(initialOwner)
		await awaitOwnerToBe(sdk.apis.nftCollection, collection, initialOwner)
		await awaitMinterToBe(sdk.apis.nftCollection, collection, [initialOwner])
		let newOwner = randomAddress()
		console.log("New expected owner", wallet1.getAddressString())
		await conf.testErc1155.methods.transferOwnership(newOwner).send({from: initialOwner})
		await awaitOwnerToBe(sdk.apis.nftCollection, collection, newOwner)
		await awaitMinterToBe(sdk.apis.nftCollection, collection, [newOwner])
	}, 30000)

	test("transfer ownership of ERC721 Ownable", async () => {
		await erc721MintOwnable(conf.testErc721Ownable, wallet1.getAddressString(), wallet1.getAddressString(), 1)
		let collection = conf.testErc721Ownable.options.address
		console.log("Collection", collection)
		let owner = await conf.testErc721Ownable.methods.owner().call()
		console.log("initial owner is" + owner)
		let initialOwner = toAddress(wallet1.getAddressString())
		console.log("Initial owner", wallet1.getAddressString())
		expect(toAddress(owner)).toBe(initialOwner)
		await awaitOwnerToBe(sdk.apis.nftCollection, collection, initialOwner)
		await awaitMinterToBe(sdk.apis.nftCollection, collection, [])
		let newOwner = randomAddress()
		console.log("New expected owner", wallet1.getAddressString())
		await conf.testErc721Ownable.methods.transferOwnership(newOwner).send({from: owner})
		await awaitOwnerToBe(sdk.apis.nftCollection, collection, newOwner)
		await awaitMinterToBe(sdk.apis.nftCollection, collection, [])

	}, 30000)
})

async function awaitOwnerToBe(api: NftCollectionControllerApi, collection: string, expectedOwner: Address) {
	await retry(3, async () => {
		const o = await api.getNftCollectionById({collection})
		expect(o.owner).toBe(expectedOwner)
	})
}

async function awaitMinterToBe(api: NftCollectionControllerApi, collection: string, minters: Address[]) {
	await retry(3, async () => {
		const o = await api.getNftCollectionById({collection})
		expect(o.minters).toStrictEqual(minters)
	})
}
