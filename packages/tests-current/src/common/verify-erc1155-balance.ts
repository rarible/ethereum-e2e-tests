import { Contract } from "web3-eth-contract"
import { retry } from "../retry"
import { toBn } from "./to-bn"

export async function verifyErc1155Balance(c: Contract, owner: string, tokenId: string, value: number | string) {
	await retry(10, async () => {
		expect(toBn(await c.methods.balanceOf(owner, tokenId).call()).toString()).toBe(`${value}`)
	})
}
