import type { AbiItem } from "web3-utils"
import Web3 from "web3"
import { Address } from "@rarible/protocol-api-client"
import { Contract } from "web3-eth-contract"
import { Ethereum, EthereumContract } from "@rarible/ethereum-provider"

const testErc1155Abi: AbiItem[] = [
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "uri",
				"type": "string",
			},
		],
		"stateMutability": "nonpayable",
		"type": "constructor",
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "account",
				"type": "address",
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "operator",
				"type": "address",
			},
			{
				"indexed": false,
				"internalType": "bool",
				"name": "approved",
				"type": "bool",
			},
		],
		"name": "ApprovalForAll",
		"type": "event",
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "operator",
				"type": "address",
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "from",
				"type": "address",
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "to",
				"type": "address",
			},
			{
				"indexed": false,
				"internalType": "uint256[]",
				"name": "ids",
				"type": "uint256[]",
			},
			{
				"indexed": false,
				"internalType": "uint256[]",
				"name": "values",
				"type": "uint256[]",
			},
		],
		"name": "TransferBatch",
		"type": "event",
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "operator",
				"type": "address",
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "from",
				"type": "address",
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "to",
				"type": "address",
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "id",
				"type": "uint256",
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "value",
				"type": "uint256",
			},
		],
		"name": "TransferSingle",
		"type": "event",
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "string",
				"name": "value",
				"type": "string",
			},
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "id",
				"type": "uint256",
			},
		],
		"name": "URI",
		"type": "event",
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "account",
				"type": "address",
			},
			{
				"internalType": "uint256",
				"name": "id",
				"type": "uint256",
			},
		],
		"name": "balanceOf",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256",
			},
		],
		"stateMutability": "view",
		"type": "function",
	},
	{
		"inputs": [
			{
				"internalType": "address[]",
				"name": "accounts",
				"type": "address[]",
			},
			{
				"internalType": "uint256[]",
				"name": "ids",
				"type": "uint256[]",
			},
		],
		"name": "balanceOfBatch",
		"outputs": [
			{
				"internalType": "uint256[]",
				"name": "",
				"type": "uint256[]",
			},
		],
		"stateMutability": "view",
		"type": "function",
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "account",
				"type": "address",
			},
			{
				"internalType": "address",
				"name": "operator",
				"type": "address",
			},
		],
		"name": "isApprovedForAll",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool",
			},
		],
		"stateMutability": "view",
		"type": "function",
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "from",
				"type": "address",
			},
			{
				"internalType": "address",
				"name": "to",
				"type": "address",
			},
			{
				"internalType": "uint256[]",
				"name": "ids",
				"type": "uint256[]",
			},
			{
				"internalType": "uint256[]",
				"name": "amounts",
				"type": "uint256[]",
			},
			{
				"internalType": "bytes",
				"name": "data",
				"type": "bytes",
			},
		],
		"name": "safeBatchTransferFrom",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function",
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "from",
				"type": "address",
			},
			{
				"internalType": "address",
				"name": "to",
				"type": "address",
			},
			{
				"internalType": "uint256",
				"name": "id",
				"type": "uint256",
			},
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256",
			},
			{
				"internalType": "bytes",
				"name": "data",
				"type": "bytes",
			},
		],
		"name": "safeTransferFrom",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function",
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "operator",
				"type": "address",
			},
			{
				"internalType": "bool",
				"name": "approved",
				"type": "bool",
			},
		],
		"name": "setApprovalForAll",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function",
	},
	{
		"inputs": [
			{
				"internalType": "bytes4",
				"name": "interfaceId",
				"type": "bytes4",
			},
		],
		"name": "supportsInterface",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool",
			},
		],
		"stateMutability": "view",
		"type": "function",
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256",
			},
		],
		"name": "uri",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string",
			},
		],
		"stateMutability": "view",
		"type": "function",
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "account",
				"type": "address",
			},
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256",
			},
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256",
			},
			{
				"internalType": "bytes",
				"name": "data",
				"type": "bytes",
			},
		],
		"name": "mint",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function",
	},
]

const testErc1155Bytecode = "0x60806040523480156200001157600080fd5b506040516200265b3803806200265b833981810160405260208110156200003757600080fd5b81019080805160405193929190846401000000008211156200005857600080fd5b838201915060208201858111156200006f57600080fd5b82518660018202830111640100000000821117156200008d57600080fd5b8083526020830192505050908051906020019080838360005b83811015620000c3578082015181840152602081019050620000a6565b50505050905090810190601f168015620000f15780820380516001836020036101000a031916815260200191505b5060405250505080620001116301ffc9a760e01b6200015a60201b60201c565b62000122816200026360201b60201c565b6200013a63d9b67a2660e01b6200015a60201b60201c565b62000152630e89341c60e01b6200015a60201b60201c565b505062000335565b63ffffffff60e01b817bffffffffffffffffffffffffffffffffffffffffffffffffffffffff19161415620001f7576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040180806020018281038252601c8152602001807f4552433136353a20696e76616c696420696e746572666163652069640000000081525060200191505060405180910390fd5b6001600080837bffffffffffffffffffffffffffffffffffffffffffffffffffffffff19167bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916815260200190815260200160002060006101000a81548160ff02191690831515021790555050565b80600390805190602001906200027b9291906200027f565b5050565b828054600181600116156101000203166002900490600052602060002090601f016020900481019282620002b7576000855562000303565b82601f10620002d257805160ff191683800117855562000303565b8280016001018555821562000303579182015b8281111562000302578251825591602001919060010190620002e5565b5b50905062000312919062000316565b5090565b5b808211156200033157600081600090555060010162000317565b5090565b61231680620003456000396000f3fe608060405234801561001057600080fd5b50600436106100925760003560e01c80634e1273f4116100665780634e1273f414610426578063731133e9146105c7578063a22cb465146106b6578063e985e9c514610706578063f242432a1461078057610092565b8062fdd58e1461009757806301ffc9a7146100f95780630e89341c1461015c5780632eb2c2d614610203575b600080fd5b6100e3600480360360408110156100ad57600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff1690602001909291908035906020019092919050505061088f565b6040518082815260200191505060405180910390f35b6101446004803603602081101561010f57600080fd5b8101908080357bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916906020019092919050505061096f565b60405180821515815260200191505060405180910390f35b6101886004803603602081101561017257600080fd5b81019080803590602001909291905050506109d6565b6040518080602001828103825283818151815260200191508051906020019080838360005b838110156101c85780820151818401526020810190506101ad565b50505050905090810190601f1680156101f55780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b610424600480360360a081101561021957600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803573ffffffffffffffffffffffffffffffffffffffff1690602001909291908035906020019064010000000081111561027657600080fd5b82018360208201111561028857600080fd5b803590602001918460208302840111640100000000831117156102aa57600080fd5b919080806020026020016040519081016040528093929190818152602001838360200280828437600081840152601f19601f8201169050808301925050505050505091929192908035906020019064010000000081111561030a57600080fd5b82018360208201111561031c57600080fd5b8035906020019184602083028401116401000000008311171561033e57600080fd5b919080806020026020016040519081016040528093929190818152602001838360200280828437600081840152601f19601f8201169050808301925050505050505091929192908035906020019064010000000081111561039e57600080fd5b8201836020820111156103b057600080fd5b803590602001918460018302840111640100000000831117156103d257600080fd5b91908080601f016020809104026020016040519081016040528093929190818152602001838380828437600081840152601f19601f820116905080830192505050505050509192919290505050610a7a565b005b6105706004803603604081101561043c57600080fd5b810190808035906020019064010000000081111561045957600080fd5b82018360208201111561046b57600080fd5b8035906020019184602083028401116401000000008311171561048d57600080fd5b919080806020026020016040519081016040528093929190818152602001838360200280828437600081840152601f19601f820116905080830192505050505050509192919290803590602001906401000000008111156104ed57600080fd5b8201836020820111156104ff57600080fd5b8035906020019184602083028401116401000000008311171561052157600080fd5b919080806020026020016040519081016040528093929190818152602001838360200280828437600081840152601f19601f820116905080830192505050505050509192919290505050610f05565b6040518080602001828103825283818151815260200191508051906020019060200280838360005b838110156105b3578082015181840152602081019050610598565b505050509050019250505060405180910390f35b6106b4600480360360808110156105dd57600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff16906020019092919080359060200190929190803590602001909291908035906020019064010000000081111561062e57600080fd5b82018360208201111561064057600080fd5b8035906020019184600183028401116401000000008311171561066257600080fd5b91908080601f016020809104026020016040519081016040528093929190818152602001838380828437600081840152601f19601f820116905080830192505050505050509192919290505050611017565b005b610704600480360360408110156106cc57600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803515159060200190929190505050611029565b005b6107686004803603604081101561071c57600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803573ffffffffffffffffffffffffffffffffffffffff1690602001909291905050506111c2565b60405180821515815260200191505060405180910390f35b61088d600480360360a081101561079657600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803573ffffffffffffffffffffffffffffffffffffffff16906020019092919080359060200190929190803590602001909291908035906020019064010000000081111561080757600080fd5b82018360208201111561081957600080fd5b8035906020019184600183028401116401000000008311171561083b57600080fd5b91908080601f016020809104026020016040519081016040528093929190818152602001838380828437600081840152601f19601f820116905080830192505050505050509192919290505050611256565b005b60008073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff161415610916576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040180806020018281038252602b815260200180612171602b913960400191505060405180910390fd5b6001600083815260200190815260200160002060008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054905092915050565b6000806000837bffffffffffffffffffffffffffffffffffffffffffffffffffffffff19167bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916815260200190815260200160002060009054906101000a900460ff169050919050565b606060038054600181600116156101000203166002900480601f016020809104026020016040519081016040528092919081815260200182805460018160011615610100020316600290048015610a6e5780601f10610a4357610100808354040283529160200191610a6e565b820191906000526020600020905b815481529060010190602001808311610a5157829003601f168201915b50505050509050919050565b8151835114610ad4576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260288152602001806122986028913960400191505060405180910390fd5b600073ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff161415610b5a576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260258152602001806121c56025913960400191505060405180910390fd5b610b626115cb565b73ffffffffffffffffffffffffffffffffffffffff168573ffffffffffffffffffffffffffffffffffffffff161480610ba85750610ba785610ba26115cb565b6111c2565b5b610bfd576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260328152602001806121ea6032913960400191505060405180910390fd5b6000610c076115cb565b9050610c178187878787876115d3565b60005b8451811015610de8576000858281518110610c3157fe5b602002602001015190506000858381518110610c4957fe5b60200260200101519050610cd0816040518060600160405280602a815260200161221c602a91396001600086815260200190815260200160002060008d73ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020546115db9092919063ffffffff16565b6001600084815260200190815260200160002060008b73ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002081905550610d87816001600085815260200190815260200160002060008b73ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205461169590919063ffffffff16565b6001600084815260200190815260200160002060008a73ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055505050806001019050610c1a565b508473ffffffffffffffffffffffffffffffffffffffff168673ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff167f4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb8787604051808060200180602001838103835285818151815260200191508051906020019060200280838360005b83811015610e98578082015181840152602081019050610e7d565b50505050905001838103825284818151815260200191508051906020019060200280838360005b83811015610eda578082015181840152602081019050610ebf565b5050505090500194505050505060405180910390a4610efd81878787878761171d565b505050505050565b60608151835114610f61576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040180806020018281038252602981526020018061226f6029913960400191505060405180910390fd5b6000835167ffffffffffffffff81118015610f7b57600080fd5b50604051908082528060200260200182016040528015610faa5781602001602082028036833780820191505090505b50905060005b845181101561100c57610fe9858281518110610fc857fe5b6020026020010151858381518110610fdc57fe5b602002602001015161088f565b828281518110610ff557fe5b602002602001018181525050806001019050610fb0565b508091505092915050565b61102384848484611aac565b50505050565b8173ffffffffffffffffffffffffffffffffffffffff166110486115cb565b73ffffffffffffffffffffffffffffffffffffffff1614156110b5576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260298152602001806122466029913960400191505060405180910390fd5b80600260006110c26115cb565b73ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060006101000a81548160ff0219169083151502179055508173ffffffffffffffffffffffffffffffffffffffff1661116f6115cb565b73ffffffffffffffffffffffffffffffffffffffff167f17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c318360405180821515815260200191505060405180910390a35050565b6000600260008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900460ff16905092915050565b600073ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff1614156112dc576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260258152602001806121c56025913960400191505060405180910390fd5b6112e46115cb565b73ffffffffffffffffffffffffffffffffffffffff168573ffffffffffffffffffffffffffffffffffffffff16148061132a5750611329856113246115cb565b6111c2565b5b61137f576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040180806020018281038252602981526020018061219c6029913960400191505060405180910390fd5b60006113896115cb565b90506113a981878761139a88611caf565b6113a388611caf565b876115d3565b611426836040518060600160405280602a815260200161221c602a91396001600088815260200190815260200160002060008a73ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020546115db9092919063ffffffff16565b6001600086815260200190815260200160002060008873ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055506114dd836001600087815260200190815260200160002060008873ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205461169590919063ffffffff16565b6001600086815260200190815260200160002060008773ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508473ffffffffffffffffffffffffffffffffffffffff168673ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff167fc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f628787604051808381526020018281526020019250505060405180910390a46115c3818787878787611d20565b505050505050565b600033905090565b505050505050565b6000838311158290611688576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825283818151815260200191508051906020019080838360005b8381101561164d578082015181840152602081019050611632565b50505050905090810190601f16801561167a5780820380516001836020036101000a031916815260200191505b509250505060405180910390fd5b5082840390509392505050565b600080828401905083811015611713576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040180806020018281038252601b8152602001807f536166654d6174683a206164646974696f6e206f766572666c6f77000000000081525060200191505060405180910390fd5b8091505092915050565b61173c8473ffffffffffffffffffffffffffffffffffffffff1661202d565b15611aa4578373ffffffffffffffffffffffffffffffffffffffff1663bc197c8187878686866040518663ffffffff1660e01b8152600401808673ffffffffffffffffffffffffffffffffffffffff1681526020018573ffffffffffffffffffffffffffffffffffffffff168152602001806020018060200180602001848103845287818151815260200191508051906020019060200280838360005b838110156117f45780820151818401526020810190506117d9565b50505050905001848103835286818151815260200191508051906020019060200280838360005b8381101561183657808201518184015260208101905061181b565b50505050905001848103825285818151815260200191508051906020019080838360005b8381101561187557808201518184015260208101905061185a565b50505050905090810190601f1680156118a25780820380516001836020036101000a031916815260200191505b5098505050505050505050602060405180830381600087803b1580156118c757600080fd5b505af19250505080156118fb57506040513d60208110156118e757600080fd5b810190808051906020019092919050505060015b611a055761190761205e565b8061191257506119b4565b806040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825283818151815260200191508051906020019080838360005b8381101561197957808201518184015260208101905061195e565b50505050905090810190601f1680156119a65780820380516001836020036101000a031916815260200191505b509250505060405180910390fd5b6040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260348152602001806121156034913960400191505060405180910390fd5b63bc197c8160e01b7bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916817bffffffffffffffffffffffffffffffffffffffffffffffffffffffff191614611aa2576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260288152602001806121496028913960400191505060405180910390fd5b505b505050505050565b600073ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff161415611b32576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260218152602001806122c06021913960400191505060405180910390fd5b6000611b3c6115cb565b9050611b5d81600087611b4e88611caf565b611b5788611caf565b876115d3565b611bc0836001600087815260200190815260200160002060008873ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205461169590919063ffffffff16565b6001600086815260200190815260200160002060008773ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508473ffffffffffffffffffffffffffffffffffffffff16600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff167fc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f628787604051808381526020018281526020019250505060405180910390a4611ca881600087878787611d20565b5050505050565b60606000600167ffffffffffffffff81118015611ccb57600080fd5b50604051908082528060200260200182016040528015611cfa5781602001602082028036833780820191505090505b5090508281600081518110611d0b57fe5b60200260200101818152505080915050919050565b611d3f8473ffffffffffffffffffffffffffffffffffffffff1661202d565b15612025578373ffffffffffffffffffffffffffffffffffffffff1663f23a6e6187878686866040518663ffffffff1660e01b8152600401808673ffffffffffffffffffffffffffffffffffffffff1681526020018573ffffffffffffffffffffffffffffffffffffffff16815260200184815260200183815260200180602001828103825283818151815260200191508051906020019080838360005b83811015611df8578082015181840152602081019050611ddd565b50505050905090810190601f168015611e255780820380516001836020036101000a031916815260200191505b509650505050505050602060405180830381600087803b158015611e4857600080fd5b505af1925050508015611e7c57506040513d6020811015611e6857600080fd5b810190808051906020019092919050505060015b611f8657611e8861205e565b80611e935750611f35565b806040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825283818151815260200191508051906020019080838360005b83811015611efa578082015181840152602081019050611edf565b50505050905090810190601f168015611f275780820380516001836020036101000a031916815260200191505b509250505060405180910390fd5b6040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260348152602001806121156034913960400191505060405180910390fd5b63f23a6e6160e01b7bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916817bffffffffffffffffffffffffffffffffffffffffffffffffffffffff191614612023576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260288152602001806121496028913960400191505060405180910390fd5b505b505050505050565b600080823b905060008111915050919050565b6000601f19601f8301169050919050565b60008160e01c9050919050565b600060443d101561206e57612111565b60046000803e61207f600051612051565b6308c379a081146120905750612111565b60405160043d036004823e80513d602482011167ffffffffffffffff821117156120bc57505050612111565b808201805167ffffffffffffffff8111156120db575050505050612111565b8060208301013d85018111156120f657505050505050612111565b6120ff82612040565b60208401016040528296505050505050505b9056fe455243313135353a207472616e7366657220746f206e6f6e2045524331313535526563656976657220696d706c656d656e746572455243313135353a204552433131353552656365697665722072656a656374656420746f6b656e73455243313135353a2062616c616e636520717565727920666f7220746865207a65726f2061646472657373455243313135353a2063616c6c6572206973206e6f74206f776e6572206e6f7220617070726f766564455243313135353a207472616e7366657220746f20746865207a65726f2061646472657373455243313135353a207472616e736665722063616c6c6572206973206e6f74206f776e6572206e6f7220617070726f766564455243313135353a20696e73756666696369656e742062616c616e636520666f72207472616e73666572455243313135353a2073657474696e6720617070726f76616c2073746174757320666f722073656c66455243313135353a206163636f756e747320616e6420696473206c656e677468206d69736d61746368455243313135353a2069647320616e6420616d6f756e7473206c656e677468206d69736d61746368455243313135353a206d696e7420746f20746865207a65726f2061646472657373a26469706673582212209a891f1f53714e69e316a4e3096982a80350868dd17ff51575e47b0a6903ae1464736f6c63430007060033"

export async function deployTestErc1155(web3: Web3, name: string = "TEST") {
	const empty = createTestErc1155(web3)
	const [address] = await web3.eth.getAccounts()
	return empty
		.deploy({ data: testErc1155Bytecode, arguments: [name] })
		.send({ from: address, gas: 3000000, gasPrice: "0" })
}

export function erc1155Mint(c: EthereumContract, from: string, to: string, tokenId: string | number, amount: number, data: string = "0x0") {
	return c.functionCall("mint", to, tokenId, amount, data).send()
}

function createTestErc1155(web3: Web3, address?: Address): Contract {
	return new web3.eth.Contract(testErc1155Abi, address)
}

export function createErc1155EthereumContract(ethereum: Ethereum, address?: Address): EthereumContract {
	return ethereum.createContract(testErc1155Abi, address)
}