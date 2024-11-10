import {
    type Address,
    createPublicClient,
    createWalletClient,
    http,
    type PublicClient,
    type WalletClient,
    type Hash,
    decodeEventLog,
} from 'viem';
import { baseSepolia as CONTRACT_CHAIN } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import {
    REAL_ESTATE_FACTORY_ABI,
    USDC_ABI,
    FACTORY_CONTRACT_ADDRESS,
    BASE_USDC_CONTRACT_ADDRESS,
    PRIVATE_KEY,
} from '../utils/abis';
import { logger } from '../utils/logger';

export interface ICreateTokenParams {
    name: string;
    symbol: string;
    initialAssetValue: number;
    maxSupply: number;
    ownerAddress: string;
}

export type TokenDetails = {
    name: string;
    symbol: string;
    assetValue: bigint;
    maxSupply: bigint;
};

class Web3ClientConfig {
    private static publicClient: PublicClient;
    private static walletClient: WalletClient;
    private static account: Address;

    static initialize() {
        try {
            // Initialize public client with transport
            this.publicClient = createPublicClient({
                chain: CONTRACT_CHAIN,
                transport: http(),
            } as const) as PublicClient;

            // Initialize wallet client
            this.walletClient = createWalletClient({
                chain: CONTRACT_CHAIN,
                transport: http(),
            });

            // Set up account
            const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
            this.account = account.address;

        } catch (error) {
            console.error('Failed to initialize Web3 clients:', error);
            throw error;
        }
    }

    static async createPropertyToken({ name, symbol, initialAssetValue, maxSupply, ownerAddress }: ICreateTokenParams): Promise<Address> {
        try {
            if (!this.walletClient || !this.account) {
                throw new Error('Web3 client not initialized');
            }

            // Convert parameters to correct types
            const args = [
                name,
                symbol,
                BigInt(initialAssetValue * 1e6),
                BigInt(maxSupply),
                ownerAddress as Address,
            ] as const;

            // Simulate the transaction with correct types
            const { request } = await this.publicClient.simulateContract({
                account: this.account,
                address: FACTORY_CONTRACT_ADDRESS as Address,
                abi: REAL_ESTATE_FACTORY_ABI,
                functionName: 'createRealEstateToken',
                args,
            });

            // Send the transaction
            const hash = await this.walletClient.writeContract(request);

            // Wait for receipt
            const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

            // Find and decode the event
            const event = receipt.logs.find(log => {
                try {
                    const decoded = decodeEventLog({
                        abi: REAL_ESTATE_FACTORY_ABI,
                        data: log.data,
                        topics: log.topics,
                    });
                    return decoded.eventName === 'RealEstateTokenCreated';
                } catch {
                    return false;
                }
            });

            if (!event) {
                throw new Error('Token creation event not found');
            }

            const decodedEvent = decodeEventLog({
                abi: REAL_ESTATE_FACTORY_ABI,
                data: event.data,
                topics: event.topics,
            });

            if (!decodedEvent.args || !('newTokenAddress' in decodedEvent.args)) {
                throw new Error('Invalid event data');
            }

            return decodedEvent.args.newTokenAddress as Address;

        } catch (error) {
            console.error('Error creating property token:', error);
            throw error;
        }
    }

    static async getUSDCBalance(userAddress: string): Promise<bigint> {
        try {
            if (!this.publicClient) {
                throw new Error('Web3 client not initialized');
            }

            const balance = await this.publicClient.readContract({
                address: BASE_USDC_CONTRACT_ADDRESS as Address,
                abi: USDC_ABI,
                functionName: 'balanceOf',
                args: [userAddress as Address],
            });

            return balance;
        } catch (error) {
            console.error('Error getting USDC balance:', error);
            throw error;
        }
    }

    static async approveUSDCSpending(spenderAddress: string, amount: bigint): Promise<Hash> {
        try {
            if (!this.walletClient || !this.account) {
                throw new Error('Web3 client not initialized');
            }

            const { request } = await this.publicClient.simulateContract({
                address: BASE_USDC_CONTRACT_ADDRESS as Address,
                abi: USDC_ABI,
                functionName: 'approve',
                args: [spenderAddress as Address, amount],
                account: this.account,
            });

            const hash = await this.walletClient.writeContract(request);
            await this.publicClient.waitForTransactionReceipt({ hash });

            return hash;
        } catch (error) {
            console.error('Error approving USDC spending:', error);
            throw error;
        }
    }
}

// // Initialize when imported
// Web3ClientConfig.initialize();

export default Web3ClientConfig;


// Maximum number of retry attempts for Web3 initialization
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 5000; // 5 seconds

export async function initializeWeb3(attempt: number = 1): Promise<void> {
    try {
        await Web3ClientConfig.initialize();
        logger.info('Web3 client initialized successfully');
    } catch (error) {
        logger.error(`Failed to initialize Web3 client (attempt ${attempt}/${MAX_RETRY_ATTEMPTS}):`, error);

        if (attempt < MAX_RETRY_ATTEMPTS) {
            logger.info(`Retrying Web3 initialization in ${RETRY_DELAY / 1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            await initializeWeb3(attempt + 1);
        } else {
            throw new Error('Failed to initialize Web3 client after maximum retry attempts');
        }
    }
}