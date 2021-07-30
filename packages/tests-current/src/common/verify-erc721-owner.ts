import { Contract } from "web3-eth-contract"

export async function verifyErc721Owner(c: Contract, tokenId: string | number, owner: string) {
	expect((await c.methods.ownerOf(tokenId).call()).toLowerCase()).toBe(owner.toLowerCase())
}
