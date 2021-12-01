import Web3 from "web3"
import {Contract} from "web3-eth-contract"
import {toAddress} from "@rarible/types"
import {verifyEthBalance} from "../common/verify-eth-balance"
import {toBn} from "../common/to-bn"

/**
 * Withdraw ETH from punk market to wallet.
 */
export async function withdrawEth(web3: Web3, contract: Contract, wallet: string, expectedPlus: number) {
	const balanceBefore = await web3.eth.getBalance(wallet)
	await contract.methods.withdraw().send({from: wallet})
	await verifyEthBalance(web3, toAddress(wallet), toBn(balanceBefore).plus(expectedPlus).toString())
}
