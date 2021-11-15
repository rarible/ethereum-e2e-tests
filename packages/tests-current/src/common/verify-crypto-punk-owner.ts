import { Contract } from "web3-eth-contract"
import { retry } from "./retry"

export async function verifyCryptoPunkOwner(c: Contract, punkIndex: Number, owner: string) {
	await retry(10, async () => {
		expect((await c.methods.punkIndexToAddress(punkIndex).call()).toLowerCase()).toBe(`${owner}`)
	})
}
