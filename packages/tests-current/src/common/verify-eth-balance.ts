import Web3 from "web3"
import { Address } from "@rarible/protocol-api-client"
import { toBn } from "./to-bn"

export async function verifyEthBalance(web3: Web3, address: Address, expectedBalance: string | number) {
	expect(toBn(await web3.eth.getBalance(address))).toStrictEqual(toBn(expectedBalance))
}
