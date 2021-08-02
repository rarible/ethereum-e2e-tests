import { createRaribleSdk } from "@rarible/protocol-ethereum-sdk"
import {Order} from '@rarible/protocol-api-client'
import fetch from "node-fetch"
import { toAddress, toBigNumber } from "@rarible/types"
import { createE2eProvider } from "./common/create-e2e-provider"
import { deployTestErc721, erc721Mint } from "./contracts/test-erc721"
import { deployTestErc20, erc20Mint } from "./contracts/test-erc20"
import { awaitAll } from "./common/await-all"
import { awaitStockToBe } from "./common/await-stock-to-be"
import { verifyErc20Balance } from "./common/verify-erc20-balance"
import { verifyErc721Owner } from "./common/verify-erc721-owner"
import { retry } from "./retry"

describe("erc721 create bid/accept bid", function() {
    const { web3: web31, wallet: wallet1 } = createE2eProvider()
    const { web3: web32, wallet: wallet2 } = createE2eProvider()

    const sdk1 = createRaribleSdk(web31, "e2e", { fetchApi: fetch })
    const sdk2 = createRaribleSdk(web32, "e2e", { fetchApi: fetch })

    const conf = awaitAll({
        testErc20: deployTestErc20(web31),
        testErc721: deployTestErc721(web31),
    })

    test("test create/accept bid of erc721", async () => {
        await erc20Mint(conf.testErc20, wallet1.getAddressString(), wallet1.getAddressString(), 100)
        await erc721Mint(conf.testErc721, wallet1.getAddressString(), wallet2.getAddressString(), 1)

        const order: Order = await sdk1.order.bid({
            makeAssetType: {
                assetClass: "ERC20",
                contract: toAddress(conf.testErc20.options.address),
            },
            takeAssetType: {
                assetClass: "ERC721",
                contract: toAddress(conf.testErc721.options.address),
                tokenId: toBigNumber("1"),
            },
            amount: 1,
            maker: toAddress(wallet1.getAddressString()),
            originFees: [],
            payouts: [],
            price: 10,
            taker: toAddress(wallet2.getAddressString()),
        }).then(a => a.runAll())

        await awaitStockToBe(sdk1.apis.order, order.hash, 10)
        await verifyErc20Balance(conf.testErc20, wallet1.getAddressString(), 100)

        const h = await sdk2.order.fill(order, { payouts: [], originFees: [], amount: 10 }).then(a => a.runAll())

        await verifyErc20Balance(conf.testErc20, wallet1.getAddressString(), 90)
        await verifyErc20Balance(conf.testErc20, wallet2.getAddressString(), 10)
        await verifyErc721Owner(conf.testErc721, 1, wallet1.getAddressString())
        await awaitStockToBe(sdk1.apis.order, order.hash, 0)

        await retry(10, async() => {
            const a = await sdk2.apis.orderActivity.getOrderActivities({ orderActivityFilter: { "@type": "by_item", contract: toAddress(conf.testErc721.options.address), tokenId: toBigNumber("1"), types: ["MATCH", "LIST", "BID"] } })
            expect(a.items.filter(a => a["@type"] === "bid")).toHaveLength(1)
            expect(a.items.filter(a => a["@type"] === "match")).toHaveLength(1)
        })
    }, 30000)
})
