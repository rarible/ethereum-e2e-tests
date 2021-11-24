export function getOwnershipId(contract: string, tokenId: number, owner: string): string {
	return `${contract}:${tokenId}:${owner}`
}
