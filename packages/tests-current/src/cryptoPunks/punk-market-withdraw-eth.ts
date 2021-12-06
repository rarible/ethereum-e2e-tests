import Web3 from "web3"
import {Contract} from "web3-eth-contract"
import {toBn} from "../common/to-bn"

/**
 * Withdraw ETH from punk market to wallet.
 */
export async function punkMarketWithdrawEth(
	web3: Web3,
	contract: Contract,
	wallet: string
): Promise<number> {
	const balanceBefore = await web3.eth.getBalance(wallet)
	await contract.methods.withdraw().send({from: wallet})
	const balanceAfter = await web3.eth.getBalance(wallet)
	return toBn(balanceAfter).minus(toBn(balanceBefore)).toNumber()
}
