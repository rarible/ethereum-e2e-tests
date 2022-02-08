import { RaribleSdk } from "@rarible/protocol-ethereum-sdk"
import { retry } from "./retry"
import { AuctionStartResponse } from "@rarible/protocol-ethereum-sdk/build/auction/start"
import { AuctionStatus } from "@rarible/ethereum-api-client/build/models/AuctionStatus"

export async function verifyAuctionStatus(sdk: RaribleSdk, auction: AuctionStartResponse, status: AuctionStatus) {
	await retry(3, async () => {
		const response = await sdk.apis.auction.getAuctionByHash({
			hash: await auction.hash
		})
		expect(response.status).toBe(status)
	})
}
