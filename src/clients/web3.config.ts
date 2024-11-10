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
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import {
    REAL_ESTATE_FACTORY_ABI,
    USDC_ABI,
    FACTORY_CONTRACT_ADDRESS,
    BASE_USDC_CONTRACT_ADDRESS,
    PRIVATE_KEY,
    FACTORY_WALLET_ADDRESS_FOR_PK,
} from '../utils/abis';
import { logger } from '../utils/logger';

export interface ICreateTokenParams {
    name: string;
    symbol: string;
    initialAssetValue: number;
    maxSupply: number;
    ownerAddress: string;
}

class Web3ClientConfig {
    private static publicClient: PublicClient;
    private static walletClient: WalletClient;
    private static account: Address;

    static initialize() {
        try {
            // Create the account from private key
            const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);

            logger.info('Derived address from private key:', account.address);
            if (account.address.toLowerCase() !== FACTORY_WALLET_ADDRESS_FOR_PK.toLowerCase()) {
                logger.error('Private key does not match expected account address');
                throw new Error('Account address mismatch');
            }

            // Initialize public client with transport and proper RPC URL
            this.publicClient = createPublicClient({
                chain: baseSepolia,
                transport: http('https://base-sepolia-rpc.publicnode.com', {
                    batch: false,
                    retryCount: 3,
                    retryDelay: 1000,
                    timeout: 30000,
                }),
            } as const) as PublicClient;

            // Initialize wallet client for server-side transactions
            this.walletClient = createWalletClient({
                account,
                chain: baseSepolia,
                transport: http('https://base-sepolia-rpc.publicnode.com', {
                    batch: false,
                    retryCount: 3,
                    retryDelay: 1000,
                    timeout: 30000,
                }),
            });

            this.account = account.address;
            logger.info('Web3 clients initialized successfully');

        } catch (error) {
            logger.error('Failed to initialize Web3 clients:', error);
            throw error;
        }
    }

    static async createPropertyToken({ name, symbol, initialAssetValue, maxSupply, ownerAddress }: ICreateTokenParams): Promise<Address> {
        try {
            if (!this.walletClient || !this.account) {
                throw new Error('Web3 client not initialized');
            }

            // Log the account being used
            logger.info('Using account for transaction:', this.account);

            // Log the attempt
            logger.info('Attempting to create property token with params:', {
                name,
                symbol,
                initialAssetValue,
                maxSupply,
                ownerAddress,
            });

            // Convert parameters to correct types
            const args = [
                name,
                symbol,
                BigInt(initialAssetValue),
                BigInt(maxSupply),
                ownerAddress as Address,
            ] as const;

            // First, simulate the transaction
            const { request } = await this.publicClient.simulateContract({
                account: this.account,
                address: FACTORY_CONTRACT_ADDRESS as Address,
                abi: REAL_ESTATE_FACTORY_ABI,
                functionName: 'createRealEstateToken',
                args,
            });

            logger.info('Contract simulation successful, preparing transaction with request...', request);

            // Send the transaction with the estimated gas
            const hash = await this.walletClient.writeContract(request);

            logger.info(`Transaction submitted with hash: ${hash}`);

            // Wait for receipt
            const receipt = await this.publicClient.waitForTransactionReceipt({
                hash,
                timeout: 60_000,
                retryCount: 3,
            });

            logger.info(`Transaction confirmed in block ${receipt.blockNumber}`);

            // Find the token creation event
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
                throw new Error('Token creation event not found in transaction receipt');
            }

            const decodedEvent = decodeEventLog({
                abi: REAL_ESTATE_FACTORY_ABI,
                data: event.data,
                topics: event.topics,
            });

            if (!decodedEvent.args || !('newTokenAddress' in decodedEvent.args)) {
                throw new Error('Invalid event data: newTokenAddress not found in event args');
            }

            const newTokenAddress = decodedEvent.args.newTokenAddress as Address;
            logger.info(`Token created successfully at address: ${newTokenAddress}`);

            return newTokenAddress;

        } catch (error) {
            logger.error('Error creating property token:', error);
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
            logger.error('Error getting USDC balance:', error);
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
            await this.publicClient.waitForTransactionReceipt({
                hash,
                timeout: 30_000,
                retryCount: 3,
            });

            return hash;
        } catch (error) {
            logger.error('Error approving USDC spending:', error);
            throw error;
        }
    }

    static async getFactoryUSDCAddress(): Promise<Address> {
        try {
            if (!this.publicClient) {
                throw new Error('Web3 client not initialized');
            }

            const usdcAddress = await this.publicClient.readContract({
                address: FACTORY_CONTRACT_ADDRESS as Address,
                abi: REAL_ESTATE_FACTORY_ABI,
                functionName: 'USDC_ADDRESS',
            }) as Address;

            logger.info('Retrieved USDC address from factory:', usdcAddress);
            return usdcAddress;
        } catch (error) {
            logger.error('Error getting USDC address from factory:', error);
            throw error;
        }
    }
}

// Retry configuration
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
            await initializeWeb3(attempt + 1);
        } else {
            throw new Error('Failed to initialize Web3 client after maximum retry attempts');
        }
    }
}

export default Web3ClientConfig;