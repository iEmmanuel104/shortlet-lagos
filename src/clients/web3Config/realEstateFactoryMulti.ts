import { ethers } from 'ethers';

export type ContractConfig = {
    rpcUrl: string;
    contractAddress: string;
    abi: any;
}

// Generic factory function to create contract instance
export const createRealEstateFactoryReadContractInstance = ({ rpcUrl, contractAddress, abi }: ContractConfig) => {
    try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const signer = provider.getSigner(
            ''
        );
        return new ethers.Contract(
            contractAddress,
            abi,
        );
    } catch (error: any) {
        console.error(`Error initializing contract: ${error.message}`);
        throw new Error('Failed to initialize contract instance');
    }
};
