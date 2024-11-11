import app from './app';
import { initiateDB } from './models';
import { logger } from './utils/logger';
import { initializeWeb3 } from './clients/web3Config';
import { cleanup } from './clients/web3Config/contracts';

async function startServer(): Promise<void> {
    try {
        // Initiate a connection to the database
        await initiateDB();

        // Initialize Web3 client with retry logic
        await initializeWeb3();

        const server = app.listen(process.env.PORT || 8090, () => {
            logger.info(`Server is running on Port ${process.env.PORT || 8090}`);
        });

        // Handle graceful shutdown
        const shutdownGracefully = async (signal: string) => {
            logger.info(`${signal} received. Starting graceful shutdown...`);

            // Close the HTTP server
            server.close(() => {
                logger.info('HTTP server closed');
            });

            // Cleanup Web3 resources
            cleanup();

            // Add any other cleanup here (e.g., database connections)

            logger.info('Graceful shutdown completed');

            // Only exit for specific signals
            if (signal === 'SIGTERM' || signal === 'SIGINT') {
                process.exit(0);
            }
        };

        // Handle different termination signals
        process.on('SIGTERM', () => shutdownGracefully('SIGTERM'));
        process.on('SIGINT', () => shutdownGracefully('SIGINT'));

        // Handle uncaught errors
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception:', error);
            shutdownGracefully('UNCAUGHT_EXCEPTION');
        });

        // Handle unhandled rejections without shutting down
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
            // Log but don't shutdown for unhandled rejections
            // This allows the application to continue running
        });

    } catch (err) {
        logger.error('Failed to start server:', err);
        process.exit(1);
    }
}

// Call the function to start the server
startServer();