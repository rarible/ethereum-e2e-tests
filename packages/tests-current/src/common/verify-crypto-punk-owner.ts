import {Contract} from "web3-eth-contract"
import {RETRY_ATTEMPTS} from "./util"
import {retry} from "./retry"

export async function verifyCryptoPunkOwner(c: Contract, punkIndex: number, owner: string) {
	await retry(RETRY_ATTEMPTS, async () => {
		const actualOwner = await c.methods.punkIndexToAddress(punkIndex).call()
		expect(actualOwner.toLowerCase()).toBe(owner)
	})
}
