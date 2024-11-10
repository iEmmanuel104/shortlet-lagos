// web3Client.ts
import { ethers } from 'ethers';
import {
    RealEstateFactoryContract,
    USDCContract,
    // RealEstateTokenContract,
    ICreateTokenParams,
} from './interface';
import {
    getFactoryContractInstance,
    getUSDCContractInstance,
    getRealEstateTokenInstance,
    getWalletSigner,
    // provider,
} from './contracts';
import { logger } from '../../utils/logger';
import {
    PRIVATE_KEY,
} from '../../utils/abis';

class Web3ClientConfig {
    private static wallet: ethers.Wallet | null = null;
    private static factoryContractWithSigner: RealEstateFactoryContract | null = null;
    private static usdcContractWithSigner: USDCContract | null = null;

    static async initialize() {
        try {
            // Initialize wallet
            this.wallet = await getWalletSigner(PRIVATE_KEY);

            // Initialize contracts with signer
            this.factoryContractWithSigner = getFactoryContractInstance(this.wallet);
            this.usdcContractWithSigner = getUSDCContractInstance(this.wallet);

            logger.info('Web3 client initialized successfully with address:', this.wallet.address);

        } catch (error) {
            logger.error('Failed to initialize Web3 client:', error);
            throw error;
        }
    }

    static async createPropertyToken({
        name,
        symbol,
        initialAssetValue,
        maxSupply,
        ownerAddress,
    }: ICreateTokenParams): Promise<string> {
        try {
            if (!this.factoryContractWithSigner) {
                throw new Error('Factory contract not initialized');
            }

            logger.info('Creating property token with params:', {
                name,
                symbol,
                initialAssetValue,
                maxSupply,
                ownerAddress,
            });

            const tx = await this.factoryContractWithSigner.createRealEstateToken(
                name,
                symbol,
                BigInt(initialAssetValue),
                BigInt(maxSupply),
                ownerAddress
            );

            logger.info(`Transaction submitted with hash: ${tx.hash}`);

            const receipt = await tx.wait();
            if (!receipt) {
                throw new Error('Transaction receipt not found');
            }

            logger.info(`Transaction confirmed in block ${receipt.blockNumber}`);

            // Find the token creation event
            const event = receipt.logs.find((log: ethers.Log) => {
                try {
                    const parsedLog = this.factoryContractWithSigner?.interface.parseLog({
                        topics: [...log.topics],
                        data: log.data,
                    });
                    return parsedLog?.name === 'RealEstateTokenCreated';
                } catch {
                    return false;
                }
            });

            if (!event) {
                throw new Error('Token creation event not found in transaction receipt');
            }

            const parsedEvent = this.factoryContractWithSigner.interface.parseLog({
                topics: [...event.topics],
                data: event.data,
            });

            if (!parsedEvent || !parsedEvent.args || !parsedEvent.args['newTokenAddress']) {
                throw new Error('Invalid event data: newTokenAddress not found in event args');
            }

            const newTokenAddress = parsedEvent.args['newTokenAddress'] as string;
            logger.info(`Token created successfully at address: ${newTokenAddress}`);
            return newTokenAddress;

        } catch (error) {
            logger.error('Error creating property token:', error);
            throw error;
        }
    }

    static async getUSDCBalance(userAddress: string): Promise<bigint> {
        try {
            const balance = await getUSDCContractInstance().balanceOf(userAddress);
            return balance;
        } catch (error) {
            logger.error('Error getting USDC balance:', error);
            throw error;
        }
    }

    static async approveUSDCSpending(spenderAddress: string, amount: bigint): Promise<string> {
        try {
            if (!this.usdcContractWithSigner) {
                throw new Error('USDC contract not initialized');
            }

            const tx = await this.usdcContractWithSigner.approve(spenderAddress, amount);
            const receipt = await tx.wait();

            if (!receipt) {
                throw new Error('Transaction receipt not found');
            }

            return tx.hash;

        } catch (error) {
            logger.error('Error approving USDC spending:', error);
            throw error;
        }
    }

    static async getFactoryUSDCAddress(): Promise<string> {
        try {
            const usdcAddress = await getFactoryContractInstance().USDC_ADDRESS();
            logger.info('Retrieved USDC address from factory:', usdcAddress);
            return usdcAddress;
        } catch (error) {
            logger.error('Error getting USDC address from factory:', error);
            throw error;
        }
    }

    static async getAllRealEstateTokens(): Promise<string[]> {
        try {
            const tokens = await getFactoryContractInstance().getAllRealEstateContracts();
            return tokens;
        } catch (error) {
            logger.error('Error getting all real estate tokens:', error);
            throw error;
        }
    }

    static async getRealEstateTokenDetails(tokenAddress: string): Promise<{
        name: string;
        symbol: string;
        assetValue: bigint;
        maxSupply: bigint;
    }> {
        try {
            const [name, symbol, assetValue, maxSupply] =
                await getFactoryContractInstance().getRealEstateTokenDetails(tokenAddress);

            return {
                name,
                symbol,
                assetValue,
                maxSupply,
            };
        } catch (error) {
            logger.error('Error getting token details:', error);
            throw error;
        }
    }

    static async buyPropertyTokenShares(
        tokenAddress: string,
        numberOfShares: bigint
    ): Promise<string> {
        try {
            if (!this.wallet) {
                throw new Error('Wallet not initialized');
            }

            const tokenContract = getRealEstateTokenInstance(tokenAddress, this.wallet);
            const tx = await tokenContract.buyShares(numberOfShares);
            const receipt = await tx.wait();

            if (!receipt) {
                throw new Error('Transaction receipt not found');
            }

            return tx.hash;
        } catch (error) {
            logger.error('Error buying property token shares:', error);
            throw error;
        }
    }

    static async withdrawPropertyTokenShares(tokenAddress: string): Promise<string> {
        try {
            if (!this.wallet) {
                throw new Error('Wallet not initialized');
            }

            const tokenContract = getRealEstateTokenInstance(tokenAddress, this.wallet);
            const tx = await tokenContract.withdrawAndCashOut();
            const receipt = await tx.wait();

            if (!receipt) {
                throw new Error('Transaction receipt not found');
            }

            return tx.hash;
        } catch (error) {
            logger.error('Error withdrawing property token shares:', error);
            throw error;
        }
    }

    static async updatePropertyTokenValue(
        tokenAddress: string,
        newValue: bigint
    ): Promise<string> {
        try {
            if (!this.wallet) {
                throw new Error('Wallet not initialized');
            }

            const tokenContract = getRealEstateTokenInstance(tokenAddress, this.wallet);
            const tx = await tokenContract.updateAssetValue(newValue);
            const receipt = await tx.wait();

            if (!receipt) {
                throw new Error('Transaction receipt not found');
            }

            return tx.hash;
        } catch (error) {
            logger.error('Error updating property token value:', error);
            throw error;
        }
    }
}

// Retry configuration for initialization
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 5000; // 5 seconds

export async function initializeWeb3(attempt: number = 1): Promise<void> {
    try {
        await Web3ClientConfig.initialize();
    } catch (error) {
        logger.error(`Failed to initialize Web3 client (attempt ${attempt}/${MAX_RETRY_ATTEMPTS}):`, error);

        if (attempt < MAX_RETRY_ATTEMPTS) {
            logger.info(`Retrying Web3 initialization in ${RETRY_DELAY / 1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            await initializeWeb3();
        } else {
            throw new Error('Failed to initialize Web3 client after maximum retry attempts');
        }
    }
}

export default Web3ClientConfig;