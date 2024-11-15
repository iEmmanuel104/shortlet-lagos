import axios from "axios"
import { realEstateFactory } from "./realEstateFactory"
import { realEstateFactoryABIEncoded } from './realEstateFactoryABIEncoded';
import { ContractConfig, createRealEstateFactoryReadContractInstance } from "./realEstateFactoryMulti";
import { REAL_ESTATE_FACTORY_ABI } from "./abis";

export type ToronetNetwork = 'testnet' | 'mainnet';

export type NetworkConfig = {
    url: string;
    contractAddress: string;
}

export type TokenConfig = {
    testnet: NetworkConfig;
    mainnet: NetworkConfig;
}

const REAL_ESTATE_FACTORY_CONFIG: ContractConfig = {
    abi: REAL_ESTATE_FACTORY_ABI,
    contractAddress: realEstateFactory.testnet.contractAddress,
    rpcUrl: realEstateFactory.testnet.url
}
// read operation
export const getRealEstateTokenDetails = async (
    address: string,
) => {
    try {
        const contractInstance = createRealEstateFactoryReadContractInstance(REAL_ESTATE_FACTORY_CONFIG);
        const tokenDetails = await contractInstance.getRealEstateTokenDetails(address);
        return tokenDetails;
    } catch (error: any) {
        console.error(`Error getting token details: ${error.message}`);
        throw new Error('Failed to get token details');
    }
};

export interface IPropertyType {
    propertyName: string
    symbol: string
    initialAssetValue: number
    maxSupply: number
    tokenOwner: string
    network: ToronetNetwork
}
// write operation
export const createRealEstateToken = async ({
    propertyName,
    symbol,
    initialAssetValue,
    maxSupply,
    tokenOwner,
    network,
}: IPropertyType) => {
    console.log({ propertyName, symbol, initialAssetValue, maxSupply, tokenOwner, network })
    const address = "0x32c940ac5764fd74c221b7c07aacd4716c603896"
    const pwd = "12345678"
    const result = await toronetFactoryContractWrite(
        address,
        pwd,
        'createRealEstateToken',
        `${encodeURIComponent(propertyName)}|${encodeURIComponent(symbol)}|${initialAssetValue}|${maxSupply}|${tokenOwner}`,
        realEstateFactory[network].contractAddress,
    );
    console.log("result from the function", result)
    const contract = result.logs[0].address
    console.log("CA:", contract)
    return contract;
};

const toronetFactoryContractWrite = async (
    address: string,
    pwd: string,
    functionname: string,
    functionarguments: string,
    contractAddress: string,
) => {
    const response = await axios.post(realEstateFactory.testnet.url, {
        op: 'callContractFunction',
        params: [
            {
                name: 'addr',
                value: address,
            },
            {
                name: 'pwd',
                value: pwd,
            },
            {
                name: 'contractaddress',
                value: contractAddress,
            },
            {
                name: 'functionname',
                value: functionname,
            },
            {
                name: 'functionarguments',
                value: functionarguments,
            },
            {
                name: 'abi',
                value: realEstateFactoryABIEncoded,
            },
        ],
    });
    return response.data;
};

