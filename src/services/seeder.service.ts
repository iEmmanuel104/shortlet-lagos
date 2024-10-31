import { Op, QueryTypes, Sequelize, Transaction } from 'sequelize';
import { faker } from '@faker-js/faker';
import User, { UserType } from '../models/user.model';
import Property from '../models/property.model';
import Investment, { IInvestment, InvestmentStatus } from '../models/investment.model';
import PropertyStats from '../models/propertyStats.model';
import Tokenomics from '../models/tokenomics.model';
import UserSettings from '../models/userSettings.model';
import { Database } from '../models';

const LOCATIONS = [
    'Lekki Phase 1, Lagos',
    'Victoria Island, Lagos',
    'Ikeja GRA, Lagos',
    'Ikoyi, Lagos',
    'Ajah, Lagos',
    'Maryland, Lagos',
    'Magodo, Lagos',
    'Gbagada, Lagos',
];

const PROPERTY_CATEGORIES = [
    'Residential',
    'Commercial',
    'Mixed Use',
    'Retail',
    'Office',
    'Industrial',
];

interface InvestmentAggregation {
    totalInvestmentAmount: string;
    totalEstimatedReturns: string;
    numberOfInvestors: string;
}

export default class SeederService {
    static async seedDatabase() {
        try {
            await Database.transaction(async (transaction: Transaction) => {
                // Create Investors (8 new ones)
                const investors = await this.createInvestors(5, transaction);

                // Create Project Owners (4 new ones)
                const projectOwners = await this.createProjectOwners(2, transaction);

                // Create Properties for each project owner (5 each)
                const properties = await this.createProperties(projectOwners, transaction);

                // Create Investments spanning 2 years
                await this.createInvestments(investors, properties, transaction);

                // Audit and update property stats
                await this.auditPropertyStats(transaction);

                return true;
            });
        } catch (error) {
            console.error('Seeding failed:', error);
            throw error;
        }
    }

    private static async createInvestors(count: number, transaction: Transaction) {
        console.log('Creating investors...');
        const investors: User[] = [];
        for (let i = 0; i < count; i++) {
            const investor = await User.create({
                walletAddress: faker.string.hexadecimal({ length: 40 }).toLowerCase(),
                email: faker.internet.email().toLowerCase(),
                firstName: faker.person.firstName(),
                lastName: faker.person.lastName(),
                username: faker.internet.username().toLowerCase(),
                type: UserType.INVESTOR,
                status: {
                    activated: true,
                    emailVerified: true,
                    walletVerified: true,
                    docsVerified: true,
                },
                phone: {
                    countryCode: '+234',
                    number: faker.phone.number({ style: 'national' }),
                },
                address: {
                    street: faker.location.streetAddress(),
                    city: 'Lagos',
                    state: 'Lagos',
                    country: 'Nigeria',
                },
            }, { transaction });

            await UserSettings.create({
                userId: investor.id,
                joinDate: faker.date.past({ years: 2 }).toISOString().split('T')[0],
                lastLogin: faker.date.recent(),
                isKycVerified: true,
                isBlocked: false,
                isDeactivated: false,
            }, { transaction });

            investors.push(investor);
        }
        console.log('Investors created:', investors.length);
        return investors;
    }

    private static async createProjectOwners(count: number, transaction: Transaction) {
        console.log('Creating project owners...');
        const projectOwners: User[] = [];
        for (let i = 0; i < count; i++) {
            const projectOwner = await User.create({
                walletAddress: faker.string.hexadecimal({ length: 40 }).toLowerCase(),
                email: faker.internet.email().toLowerCase(),
                firstName: faker.person.firstName(),
                lastName: faker.person.lastName(),
                username: faker.internet.username().toLowerCase(),
                type: UserType.PROJECT_OWNER,
                status: {
                    activated: true,
                    emailVerified: true,
                    walletVerified: true,
                    docsVerified: true,
                },
                phone: {
                    countryCode: '+234',
                    number: faker.phone.number({ style: 'national' }),
                },
                address: {
                    street: faker.location.streetAddress(),
                    city: 'Lagos',
                    state: 'Lagos',
                    country: 'Nigeria',
                },
            }, { transaction });

            await UserSettings.create({
                userId: projectOwner.id,
                joinDate: faker.date.past({ years: 2 }).toISOString().split('T')[0],
                lastLogin: faker.date.recent(),
                isKycVerified: true,
                isBlocked: false,
                isDeactivated: false,
            }, { transaction });

            projectOwners.push(projectOwner);
        }
        console.log('Project owners created:', projectOwners.length);
        return projectOwners;
    }

    private static async createProperties(projectOwners: User[], transaction: Transaction) {
        console.log('Creating properties...');
        const properties: Property[] = [];
        for (const owner of projectOwners) {
            for (let i = 0; i < 5; i++) {
                // Adjusted price range to stay within DECIMAL(10,2) limits
                const price = faker.number.int({ min: 1000000, max: 90000000 });
                const property = await Property.create({
                    category: faker.helpers.arrayElements(PROPERTY_CATEGORIES, { min: 1, max: 3 }),
                    name: faker.company.name() + ' ' + faker.location.street(),
                    description: faker.lorem.paragraphs(3),
                    location: faker.helpers.arrayElement(LOCATIONS),
                    price,
                    gallery: Array(4).fill(null).map(() => faker.image.url()),
                    banner: faker.image.url(),
                    document: Array(2).fill(null).map(() => faker.system.filePath()),
                    isDraft: false,
                    contractAddress: faker.string.hexadecimal({ length: 40 }).toLowerCase(),
                    listingPeriod: {
                        start: faker.date.past({ years: 1 }),
                        end: faker.date.future({ years: 1 }),
                    },
                    metrics: {
                        // Ensure TIG doesn't exceed the maximum value
                        TIG: Math.min(price * 0.8, 90000000),
                        // Adjusted MIA range
                        MIA: faker.number.int({ min: 50000, max: 500000 }),
                        PAR: faker.number.float({ min: 1, max: 3, fractionDigits: 1 }),
                    },
                    ownerId: owner.id,
                }, { transaction });

                await PropertyStats.create({
                    propertyId: property.id,
                    yield: 0,
                    totalInvestmentAmount: 0,
                    totalEstimatedReturns: 0,
                    overallRating: 0,
                    numberOfInvestors: 0,
                    ratingCount: 0,
                    visitCount: 0,
                }, { transaction });

                await Tokenomics.create({
                    propertyId: property.id,
                    totalTokenSupply: 1000000,
                    remainingTokens: 1000000,
                    tokenPrice: faker.number.float({ min: 1, max: 10, fractionDigits: 2 }),
                    distribution: {
                        team: 10,
                        advisors: 5,
                        investors: 80,
                        other: 5,
                    },
                    distributionDescription: faker.lorem.paragraph(),
                }, { transaction });

                properties.push(property);
            }
        }
        console.log('Properties created:', properties.length);
        return properties;
    }

    private static async createInvestments(investors: User[], newProperties: Property[], transaction: Transaction) {
        console.log('Creating investments...');
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

        // Get existing properties that have no investments
        const existingProperties = await Property.findAll({
            where: {
                id: {
                    [Op.notIn]: Sequelize.literal(
                        '(SELECT DISTINCT "propertyId" FROM "Investments")'
                    ),
                },
            },
            include: [{
                model: User,
                as: 'owner',
                attributes: ['id'],
            }],
            transaction,
        });

        console.log(`Found ${existingProperties.length} existing properties without investments`);

        // Combine new and existing properties
        const allProperties = [...newProperties, ...existingProperties];
        console.log(`Total properties to process: ${allProperties.length}`);

        const investments: Partial<Investment>[] = [];

        // Create investments for each property
        for (const property of allProperties) {
            // Determine number of investors for this property (2-4 investors per property)
            const investorCount = faker.number.int({ min: 2, max: 4 });

            // Select random investors for this property
            const selectedInvestors = faker.helpers.arrayElements(investors, investorCount);

            // Each selected investor makes 1-3 investments in the property
            for (const investor of selectedInvestors) {
                const investmentCount = faker.number.int({ min: 1, max: 3 });

                for (let i = 0; i < investmentCount; i++) {
                    const investmentDate = faker.date.between({ from: twoYearsAgo, to: new Date() });

                    // Ensure maxAmount is at least twice the MIA and at most the TIG/5
                    const minAmount = property.metrics.MIA;
                    const maxAmount = Math.max(
                        minAmount * 2,
                        Math.min(property.metrics.TIG / 5, 90000000)
                    );

                    // Generate amount between MIA and maxAmount
                    const amount = minAmount === maxAmount
                        ? minAmount
                        : faker.number.int({
                            min: minAmount,
                            max: maxAmount,
                        });

                    const returnMultiplier = faker.number.float({ min: 1.1, max: 1.5, fractionDigits: 2 });
                    const estimatedReturns = Math.min(amount * returnMultiplier, 90000000);

                    investments.push({
                        propertyId: property.id,
                        investorId: investor.id,
                        amount,
                        date: investmentDate,
                        sharesAssigned: Math.floor(amount / property.metrics.MIA),
                        estimatedReturns,
                        status: faker.helpers.arrayElement(Object.values(InvestmentStatus)),
                        propertyOwner: property.owner?.id || property.ownerId,
                    });
                }
            }
        }

        // Sort investments by date to maintain chronological order
        investments.sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());

        // Bulk create all investments at once
        console.log(`Creating ${investments.length} investments in bulk...`);
        await Investment.bulkCreate(investments as IInvestment[], {
            transaction,
            validate: true,
            hooks: true,
        });
        console.log('Investments created successfully');

        // Log distribution statistics
        const propertyInvestmentCounts = investments.reduce((acc, inv) => {
            acc[inv.propertyId!] = (acc[inv.propertyId!] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const investorInvestmentCounts = investments.reduce((acc, inv) => {
            acc[inv.investorId!] = (acc[inv.investorId!] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        console.log('Investment distribution:');
        console.log(`Average investments per property: ${Object.values(propertyInvestmentCounts).reduce((a, b) => a + b, 0) / Object.keys(propertyInvestmentCounts).length
        }`);
        console.log(`Average investments per investor: ${Object.values(investorInvestmentCounts).reduce((a, b) => a + b, 0) / Object.keys(investorInvestmentCounts).length
        }`);
    }

    private static async auditPropertyStats(transaction: Transaction) {
        console.log('Starting property stats audit...');

        // Get all properties with their creation dates
        const properties = await Property.findAll({
            attributes: ['id', 'createdAt'],
            transaction,
        });

        const propertyIds = properties.map(p => p.id);

        // Clean up orphaned stats
        const orphanedStats = await PropertyStats.findAll({
            where: {
                propertyId: {
                    [Op.notIn]: propertyIds,
                },
            },
            transaction,
        });

        if (orphanedStats.length > 0) {
            console.log(`Found ${orphanedStats.length} orphaned property stats records`);
            await PropertyStats.destroy({
                where: {
                    propertyId: {
                        [Op.notIn]: propertyIds,
                    },
                },
                transaction,
            });
            console.log('Orphaned property stats records cleaned up');
        }

        // Update existing stats
        console.log('Updating property stats...');
        for (const property of properties) {
            // Get aggregated investment data using raw query
            const [investmentStats] = await Database.query<InvestmentAggregation>(
                `
            SELECT 
                COALESCE(SUM("amount"), 0) as "totalInvestmentAmount",
                COALESCE(SUM("estimatedReturns"), 0) as "totalEstimatedReturns",
                COUNT(DISTINCT "investorId") as "numberOfInvestors"
            FROM "Investments"
            WHERE "propertyId" = :propertyId
            GROUP BY "propertyId"
            `,
                {
                    replacements: { propertyId: property.id },
                    type: QueryTypes.SELECT,
                    transaction,
                }
            );

            const stats = await PropertyStats.findOne({
                where: { propertyId: property.id },
                transaction,
            });

            // Calculate days since property creation with a minimum of 30 days
            const daysSinceCreation = Math.max(
                30,
                Math.ceil((new Date().getTime() - new Date(property.createdAt).getTime()) / (1000 * 60 * 60 * 24))
            );

            // Generate more realistic visit counts based on property age
            // Higher initial visits that taper off over time
            const baseVisits = faker.number.int({ min: 100, max: 300 }); // Initial surge
            const dailyVisits = faker.number.int({ min: 10, max: 30 }); // Ongoing daily visits
            const visitCount = Math.floor(baseVisits + (daysSinceCreation * dailyVisits * 0.7)); // 0.7 factor for realistic tapering

            // Generate realistic ratings with better distribution
            // Assume 2-8% of visitors leave ratings
            const ratingPercentage = faker.number.float({ min: 0.02, max: 0.08 });
            const ratingCount = Math.floor(visitCount * ratingPercentage);

            let overallRating = 0;
            if (ratingCount > 0) {
                // Enhanced rating distribution
                // [1-star, 2-star, 3-star, 4-star, 5-star] weights
                const weights = [5, 10, 15, 35, 35]; // More realistic distribution favoring 4-5 stars
                const totalWeight = weights.reduce((a, b) => a + b, 0);

                let totalRating = 0;
                let actualRatingCount = 0;

                weights.forEach((weight, index) => {
                    const starCount = index + 1;
                    // Calculate number of ratings for this star level
                    const ratingsForStar = Math.round((weight / totalWeight) * ratingCount);
                    // Add some randomness to the distribution
                    const actualRatings = faker.number.int({
                        min: Math.floor(ratingsForStar * 0.8),
                        max: Math.ceil(ratingsForStar * 1.2),
                    });

                    totalRating += starCount * actualRatings;
                    actualRatingCount += actualRatings;
                });

                // Calculate final rating with realistic precision
                overallRating = Number((totalRating / actualRatingCount).toFixed(1));
            }

            const statsData = {
                totalInvestmentAmount: investmentStats ? Number(investmentStats.totalInvestmentAmount) : 0,
                totalEstimatedReturns: investmentStats ? Number(investmentStats.totalEstimatedReturns) : 0,
                numberOfInvestors: investmentStats ? Number(investmentStats.numberOfInvestors) : 0,
                yield: 0,
                visitCount,
                ratingCount,
                overallRating: Math.min(5, Math.max(1, overallRating)), // Ensure rating is between 1-5
            };

            // Calculate yield
            if (statsData.totalInvestmentAmount > 0) {
                statsData.yield = Number(
                    (((statsData.totalEstimatedReturns - statsData.totalInvestmentAmount) /
                        statsData.totalInvestmentAmount) * 100).toFixed(2)
                );
            }

            if (stats) {
                await stats.update(statsData, { transaction });
            } else {
                await PropertyStats.create({
                    propertyId: property.id,
                    ...statsData,
                }, { transaction });
            }
        }

        const finalStatsCount = await PropertyStats.count({ transaction });
        console.log(`Property stats audit completed. Final stats count: ${finalStatsCount}`);
    }
}