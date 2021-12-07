import {Contract} from "web3-eth-contract"
import {toBn} from "./to-bn"

export async function verifyErc20Balance(c: Contract, owner: string, value: number | string) {
	expect(toBn(await c.methods.balanceOf(owner).call()).toString()).toBe(`${value}`)
}
