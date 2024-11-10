// contracts.ts
import { ethers } from 'ethers';
import {
    RealEstateFactoryContract,
    USDCContract,
    RealEstateTokenContract,
} from './interface';
import {
    REAL_ESTATE_FACTORY_ABI,
    USDC_ABI,
    FACTORY_CONTRACT_ADDRESS,
    BASE_USDC_CONTRACT_ADDRESS,
    BASE_SEPOLIA_RPC,
} from './abis';

// Initialize provider
export const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC, {
    chainId: 84532,
    name: 'base-sepolia',
});

// Initialize base contract instances
export const factoryContract = new ethers.Contract(
    FACTORY_CONTRACT_ADDRESS,
    REAL_ESTATE_FACTORY_ABI,
    provider
) as unknown as RealEstateFactoryContract;

export const usdcContract = new ethers.Contract(
    BASE_USDC_CONTRACT_ADDRESS,
    USDC_ABI,
    provider
) as unknown as USDCContract;

// Get contract instances with optional signer
export function getFactoryContractInstance(signerOrProvider?: ethers.Signer | ethers.Provider): RealEstateFactoryContract {
    if (signerOrProvider) {
        return factoryContract.connect(signerOrProvider) as RealEstateFactoryContract;
    }
    return factoryContract;
}

export function getUSDCContractInstance(signerOrProvider?: ethers.Signer | ethers.Provider): USDCContract {
    if (signerOrProvider) {
        return usdcContract.connect(signerOrProvider) as USDCContract;
    }
    return usdcContract;
}

export function getRealEstateTokenInstance(
    address: string,
    signerOrProvider: ethers.Signer | ethers.Provider = provider
): RealEstateTokenContract {
    return new ethers.Contract(
        address,
        REAL_ESTATE_FACTORY_ABI,
        signerOrProvider
    ) as unknown as RealEstateTokenContract;
}

// Helper function to get signer for wallet
export async function getWalletSigner(privateKey: string): Promise<ethers.Wallet> {
    return new ethers.Wallet(privateKey, provider);
}