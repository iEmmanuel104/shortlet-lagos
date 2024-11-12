/* eslint-disable no-undef */
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
import { logger } from '../../utils/logger';
import { BadRequestError } from '../../utils/customErrors';

class ContractsManager {
    private static provider: ethers.JsonRpcProvider | null = null;
    private static factoryContract: RealEstateFactoryContract | null = null;
    private static usdcContract: USDCContract | null = null;
    private static isInitialized: boolean = false;
    private static connectionCheckInterval: NodeJS.Timeout | null = null;
    private static reconnectTimeout: NodeJS.Timeout | null = null;
    private static lastBlockNumber: number = 0;
    private static consecutiveFailures: number = 0;
    private static readonly MAX_CONSECUTIVE_FAILURES = 3;

    static async initialize() {
        if (this.isInitialized) {
            return;
        }

        const maxRetries = 3;
        const retryDelay = 300000; // 5 minutes

        for (let i = 0; i < maxRetries; i++) {
            try {
                // Initialize provider with better options
                this.provider = new ethers.JsonRpcProvider(
                    BASE_SEPOLIA_RPC,
                    {
                        chainId: 84532,
                        name: 'base-sepolia',
                    },
                    {
                        // staticNetwork: true,
                        polling: true,
                        // pollingInterval: 4000, // 4 seconds
                        batchMaxCount: 1, // Limit concurrent requests
                        // cacheTimeout: 2000, // 2 seconds cache
                    }
                );


                // Test the connection and store initial block number
                const network = await this.provider.getNetwork();
                this.lastBlockNumber = await this.provider.getBlockNumber();
                logger.info('Connected to network:', network.name, 'at block:', this.lastBlockNumber);

                // Initialize base contract instances
                this.factoryContract = new ethers.Contract(
                    FACTORY_CONTRACT_ADDRESS,
                    REAL_ESTATE_FACTORY_ABI,
                    this.provider
                ) as unknown as RealEstateFactoryContract;

                this.usdcContract = new ethers.Contract(
                    BASE_USDC_CONTRACT_ADDRESS,
                    USDC_ABI,
                    this.provider
                ) as unknown as USDCContract;

                // Start connection monitoring
                this.startConnectionMonitoring();

                this.isInitialized = true;
                this.consecutiveFailures = 0; // Reset failure counter on successful initialization
                logger.info('Contracts manager initialized successfully');
                return;

            } catch (error) {
                logger.error(`Provider initialization attempt ${i + 1} failed:`, error);
                if (i < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                } else {
                    throw new BadRequestError('Failed to initialize provider after maximum retries');
                }
            }
        }
    }

    private static async isConnectionValid(): Promise<boolean> {
        try {
            if (!this.provider) return false;

            const currentBlockNumber = await this.provider.getBlockNumber();
            const isProgressingChain = currentBlockNumber >= this.lastBlockNumber;
            this.lastBlockNumber = currentBlockNumber;

            return isProgressingChain;
        } catch {
            return false;
        }
    }

    private static startConnectionMonitoring() {
        // Clear existing interval if it exists
        if (this.connectionCheckInterval) {
            clearInterval(this.connectionCheckInterval);
        }

        // Check connection every minute
        this.connectionCheckInterval = setInterval(async () => {
            try {
                if (!await this.isConnectionValid()) {
                    this.consecutiveFailures++;
                    logger.info(`Connection check failed. Consecutive failures: ${this.consecutiveFailures}`);

                    if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
                        void this.handleConnectionError();
                    }
                } else {
                    if (this.consecutiveFailures > 0) {
                        logger.info('Connection restored');
                    }
                    this.consecutiveFailures = 0;
                }
            } catch (error) {
                logger.error('Connection monitoring error:', error);
                this.consecutiveFailures++;
                if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
                    void this.handleConnectionError();
                }
            }
        }, 60000); // Check every minute
    }

    private static async handleConnectionError() {
        if (this.reconnectTimeout) {
            return; // Already attempting to reconnect
        }

        logger.info('Connection unstable - initiating reconnection...');

        // Set reconnection timeout
        this.reconnectTimeout = setTimeout(async () => {
            try {
                this.cleanup(false); // Cleanup but don't log
                await this.initialize();
                this.reconnectTimeout = null;
            } catch (error) {
                logger.error('Reconnection failed:', error);
                this.reconnectTimeout = null;
                // Reset consecutive failures to prevent immediate retry
                this.consecutiveFailures = 0;
            }
        }, 5000);
    }

    private static ensureInitialized() {
        if (!this.isInitialized) {
            throw new BadRequestError('ContractsManager not initialized. Call initialize() first.');
        }
    }

    // Rest of the getter methods remain the same
    static getProvider(): ethers.JsonRpcProvider {
        this.ensureInitialized();
        if (!this.provider) {
            throw new BadRequestError('Provider not initialized');
        }
        return this.provider;
    }

    static getFactoryContract(): RealEstateFactoryContract {
        this.ensureInitialized();
        if (!this.factoryContract) {
            throw new BadRequestError('Factory contract not initialized');
        }
        return this.factoryContract;
    }

    static getUSDCContract(): USDCContract {
        this.ensureInitialized();
        if (!this.usdcContract) {
            throw new BadRequestError('USDC contract not initialized');
        }
        return this.usdcContract;
    }

    static getFactoryContractInstance(signerOrProvider?: ethers.Signer | ethers.Provider): RealEstateFactoryContract {
        const contract = this.getFactoryContract();
        if (signerOrProvider) {
            return contract.connect(signerOrProvider) as RealEstateFactoryContract;
        }
        return contract;
    }

    static getUSDCContractInstance(signerOrProvider?: ethers.Signer | ethers.Provider): USDCContract {
        const contract = this.getUSDCContract();
        if (signerOrProvider) {
            return contract.connect(signerOrProvider) as USDCContract;
        }
        return contract;
    }

    static getRealEstateTokenInstance(
        address: string,
        signerOrProvider: ethers.Signer | ethers.Provider = this.getProvider()
    ): RealEstateTokenContract {
        this.ensureInitialized();
        return new ethers.Contract(
            address,
            REAL_ESTATE_FACTORY_ABI,
            signerOrProvider
        ) as unknown as RealEstateTokenContract;
    }

    static async getWalletSigner(privateKey: string): Promise<ethers.Wallet> {
        this.ensureInitialized();
        return new ethers.Wallet(privateKey, this.getProvider());
    }

    static cleanup(shouldLog: boolean = true) {
        if (this.connectionCheckInterval) {
            clearInterval(this.connectionCheckInterval);
            this.connectionCheckInterval = null;
        }

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        if (this.provider) {
            this.provider = null;
        }

        this.factoryContract = null;
        this.usdcContract = null;
        this.isInitialized = false;
        this.consecutiveFailures = 0;

        if (shouldLog) {
            logger.info('ContractsManager cleaned up');
        }
    }
}

// Export the initialization function
export const initializeContracts = ContractsManager.initialize.bind(ContractsManager);

// Export everything through the ContractsManager
export const getProvider = ContractsManager.getProvider.bind(ContractsManager);
export const getFactoryContractInstance = ContractsManager.getFactoryContractInstance.bind(ContractsManager);
export const getUSDCContractInstance = ContractsManager.getUSDCContractInstance.bind(ContractsManager);
export const getRealEstateTokenInstance = ContractsManager.getRealEstateTokenInstance.bind(ContractsManager);
export const getWalletSigner = ContractsManager.getWalletSigner.bind(ContractsManager);

// Export cleanup function
export const cleanup = ContractsManager.cleanup.bind(ContractsManager);