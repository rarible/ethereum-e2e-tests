import {awaitAll} from "@rarible/ethereum-sdk-test-common/build/await-all"
import {initProviders} from "./common/init-providers"
import {deployTestErc721Rarible} from "./contracts/test-erc721-rarible"
import {randomAddress, toAddress} from "@rarible/types";
import {createRaribleSdk} from "@rarible/protocol-ethereum-sdk";
import {Web3Ethereum} from "@rarible/web3-ethereum";
import {Address, NftCollectionControllerApi, OrderControllerApi} from "@rarible/protocol-api-client";
import {retry} from "./common/retry";

describe("transfer token ownership", function () {
    const {
        web31, wallet1
    } = initProviders({})

    const conf = awaitAll({
        testErc721: deployTestErc721Rarible(web31),
    })

    const sdk = createRaribleSdk(new Web3Ethereum({ web3: web31 }), "e2e")

    test("transfer ownership of ERC721Rarible", async () => {
        let collection = conf.testErc721.options.address;
        console.log("Collection", collection)
        let owner = await conf.testErc721.methods.owner().call()
        let initialOwner = toAddress(wallet1.getAddressString());
        console.log("Initial owner", wallet1.getAddressString())
        expect(toAddress(owner)).toBe(initialOwner)
        await awaitOwnerToBe(sdk.apis.nftCollection, collection, initialOwner)
        let newOwner = randomAddress();
        console.log("New expected owner", wallet1.getAddressString())
        await conf.testErc721.methods.transferOwnership(newOwner).send({from: initialOwner})
        await awaitOwnerToBe(sdk.apis.nftCollection, collection, newOwner)
    }, 30000)
})

async function awaitOwnerToBe(api: NftCollectionControllerApi, collection: string, expectedOwner: Address) {
    await retry(3, async () => {
        const o = await api.getNftCollectionById({ collection })
        expect(o.owner).toBe(expectedOwner)
    })
}