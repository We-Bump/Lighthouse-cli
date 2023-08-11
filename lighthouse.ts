import { program } from "commander"
import ora from "ora"
import inquirer from "inquirer"
import chalk from "chalk"
import fs from "fs"
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing"
import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate"
import { GasPrice } from "@cosmjs/stargate";
import { MerkleTree } from 'merkletreejs';
import BigNumber from 'bignumber.js';
import { processCliUpload } from "./arweave"
import { keccak_256 } from '@noble/hashes/sha3'
import path from "path"

const LIGHTHOUSE_CONTRACT = "sei1daj8pj34e7n58w45av8qt8y30hkcq2lqav0sqz4pva9twh5a2nyq9m6zq7"

export const saveLogs = (logs: any) => {
    //add logs to log file if exists
    if (fs.existsSync("./logs.json")) {
        let logFile: any = []
        try {
            logFile = JSON.parse(fs.readFileSync("./logs.json", "utf-8"))
            logFile.push(logs)
        } catch (e) {
            logFile = logs
        }
        fs.writeFileSync("./logs.json", JSON.stringify(logFile, null, 4))
    } else {
        fs.writeFileSync("./logs.json", JSON.stringify(logs, null, 4))
    }
}

const loadConfig = () => {
    //check if config exists
    if (fs.existsSync("./config.json")) {
        let config = JSON.parse(fs.readFileSync("./config.json", "utf-8"))

        if (!config.mnemonic || !config.rpc || !config.network) {
            console.log(chalk.red("\nConfig file is missing required fields (mnemonic, rpc, network)"))
            process.exit(1)
        }

        return config

    } else {
        console.log(chalk.red("\nConfig file not found"))
        process.exit(1)
    }
}

const main = () => {

    program
        .name("lighthouse")
        .description("Lighthouse is a tool for creating NFT collections on the SEI blockchain.")
        .version("0.3.2")

    program
        .command("load-wallet")
        .description("Load a wallet from a mnemonic")
        .action(async () => {
            let wallet = await inquirer.prompt([
                {
                    type: "input",
                    name: "wallet",
                    message: "What is the mnemonic keyphrase of the address you want to use in lighthouse?"
                }
            ])

            if (fs.existsSync("./config.json")) {
                let config = JSON.parse(fs.readFileSync("./config.json", "utf-8"))
                config.mnemonic = wallet.wallet
                fs.writeFileSync("./config.json", JSON.stringify(config, null, 4))
            } else {
                let config = {
                    mnemonic: wallet.wallet
                }
                fs.writeFileSync("./config.json", JSON.stringify(config, null, 4))
            }

            console.log(chalk.green("Saved to config.json"))
        })

    program
        .command("load-rpc")
        .description("Load a wallet from a mnemonic")
        .action(async () => {
            let rpc = await inquirer.prompt([
                {
                    type: "input",
                    name: "rpc",
                    message: "What is the RPC you want to use"
                }
            ])

            if (fs.existsSync("./config.json")) {
                let config = JSON.parse(fs.readFileSync("./config.json", "utf-8"))
                config.rpc = rpc.rpc
                fs.writeFileSync("./config.json", JSON.stringify(config, null, 4))
            } else {
                let config = {
                    rpc: rpc.rpc
                }
                fs.writeFileSync("./config.json", JSON.stringify(config, null, 4))
            }

            console.log(chalk.green("Saved to config.json"))
        })

    program
        .command("load-network")
        .description("Select available network to use")
        .action(async () => {
            let network = await inquirer.prompt([
                {
                    type: "list",
                    name: "network",
                    message: "What is the network you want to use?",
                    choices: ['atlantic-2']
                }
            ])

            if (fs.existsSync("./config.json")) {
                let config = JSON.parse(fs.readFileSync("./config.json", "utf-8"))
                config.network = network.network
                fs.writeFileSync("./config.json", JSON.stringify(config, null, 4))
            } else {
                let config = {
                    network: network.network
                }
                fs.writeFileSync("./config.json", JSON.stringify(config, null, 4))
            }

            console.log(chalk.green("Saved to config.json"))
        })

    program
        .command("init")
        .description("Initialize a new project configuration")
        .action(() => {
            let isConfig = fs.existsSync("./config.json")

            if (isConfig) {
                inquirer.prompt([
                    {
                        type: "confirm",
                        name: "overwrite",
                        message: "A config.json file already exists. Do you want to overwrite it?",
                        default: false
                    }
                ]).then((answers) => {
                    if (answers.overwrite) {
                        console.log("Overwriting config.json")
                        createDefaultConfig()
                    } else {
                        console.log("Exiting")
                    }
                })
            } else {
                createDefaultConfig()
            }
        })

    program
        .command("validate")
        .description("Validate JSON metadata files")
        .action(() => {
            let spinner = ora("Validating files").start()

            let files = fs.readdirSync("./assets").filter((file) => file.endsWith(".json"))

            //validate images
            for (let file of files) {
                try {
                    let metadata = JSON.parse(fs.readFileSync("./assets/" + file, "utf-8"))
                    if (!metadata.image) {
                        spinner.fail("Image field not found in metadata file " + file)
                        return
                    } else {
                        if (!fs.existsSync("./assets/" + metadata.image)) {
                            spinner.fail("Image not found for metadata file " + file)
                            return
                        }
                    }
                } catch (e) {
                    spinner.fail("Invalid metadata file " + file)
                    return
                }
            }

            spinner.succeed("Files valid")
        })

    program
        .command("upload")
        .description("Upload JSON metadata files to Arweave")
        .option("--wallet <wallet>", "Path to Arweave keypair JSON file")
        .option("--url <url>", "Arweave node URL")
        .action(async (answers) => {
            processCliUpload(answers)
        })

    program
        .command("generate-merkle-root")
        .description("Generate Merkle root from wallet addresses")
        .argument("<file>", "Path to JSON file containing wallet addresses")
        .action((file) => {
            // Read wallet addresses
            let wallets = JSON.parse(fs.readFileSync(file, "utf-8"))

            // Hash wallet addresses
            let hashedWallets = wallets.map(keccak_256)

            // Generate Merkle tree
            const tree = new MerkleTree(hashedWallets, keccak_256, { sortPairs: true })
            const merkleRoot = tree.getRoot().toString('hex')

            console.log(`Merkle root: ${merkleRoot}`)
        });


    program
        .command("generate-merkle-proof")
        .description("Generate Merkle proof from wallet address")
        .argument("<file>", "Path to JSON file containing wallet addresses")
        .argument("<wallet>", "Wallet address to generate proof for")
        .action((file, wallet) => {
            // Read wallet addresses
            let wallets = JSON.parse(fs.readFileSync(file, "utf-8"))

            // check if wallet exists
            if (wallets.indexOf(wallet) === -1) {
                console.log(chalk.red("Wallet not found"))
                return
            }

            // Hash wallet addresses
            let hashedWallets = wallets.map(keccak_256)

            // Generate Merkle tree
            const tree = new MerkleTree(hashedWallets, keccak_256, { sortPairs: true })
            const merkleRoot = tree.getRoot().toString('hex')

            // Generate Merkle proof
            const proof = tree.getProof(Buffer.from(keccak_256(wallet))).map(element => element.data.toString('hex'))

            console.log("verification: " + tree.verify(proof, Buffer.from(keccak_256(wallet)), merkleRoot))

            console.log(`Merkle root: ${merkleRoot}`)
            console.log(`Merkle proof:`)
            console.log(proof)
        });



    program
        .command("mint")
        .description("Mint new NFTs from an existing NFT collection")
        .argument("<collection>")
        .argument("<group_name>", "Mint from a specific group")
        .option("--gas-price <gas_price>", "Gas price to use for transaction (default: 0.1)")
        .action(async (collection, groupName, answers) => {

            if (groupName) {
                console.log("Minting from group: " + groupName)
            } else {
                console.log(chalk.red("You must specify a group to mint from"))
                return
            }

            let config = loadConfig()

            const wallet = await DirectSecp256k1HdWallet.fromMnemonic(config.mnemonic, {
                prefix: "sei",
            })
            const [firstAccount] = await wallet.getAccounts()

            const client = await SigningCosmWasmClient.connectWithSigner(config.rpc, wallet, {
                gasPrice: GasPrice.fromString(answers.gasPrice ? answers.gasPrice + "usei" : "0.1usei")
            })

            let lighthouseConfig = await client.queryContractSmart(LIGHTHOUSE_CONTRACT, { get_config: {} })
            let collectionConfig = await client.queryContractSmart(LIGHTHOUSE_CONTRACT, { get_collection: { collection } })

            let group: any = null

            for (let g of collectionConfig.mint_groups) {
                if (g.name === groupName) {
                    group = g
                    break;
                }
            }

            if (group === null) {
                console.log(chalk.red("Group not found"))
                return
            }

            let merkleProof: any = null
            let hashedAddress: any = null

            let recipient = await inquirer.prompt([
                {
                    type: "input",
                    name: "recipient",
                    message: "Enter recipient address (default: " + firstAccount.address + ")"
                }
            ])

            if (group.merkle_root !== "" && group.merkle_root !== null) {
                //ask for proof
                let proof = await inquirer.prompt([
                    {
                        type: "input",
                        name: "proof",
                        message: "Enter Merkle proof for group " + groupName + " separated by commas"
                    }
                ])

                let proofArray = proof.proof.split(",")

                merkleProof = proofArray.map((p: string) => Array.from(Buffer.from(p, 'hex')))

                hashedAddress = Array.from(Buffer.from(keccak_256(recipient.recipient ? recipient.recipient : firstAccount.address)))
            }


            let spinner = ora("Minting NFT").start()
            const mintMsg = {
                mint_native: {
                    collection,
                    group: groupName,
                    recipient: recipient.recipient ? recipient.recipient : null,
                    merkle_proof: merkleProof,
                    hashed_address: hashedAddress
                }
            }

            const coins = [{
                denom: 'usei',
                amount: new BigNumber(group.unit_price).plus(new BigNumber(lighthouseConfig.fee)).toString()
            }];


            const mintReceipt = await client.execute(firstAccount.address, LIGHTHOUSE_CONTRACT, mintMsg, "auto", "", coins)

            spinner.succeed("NFT minted")
            console.log("Transaction hash: " + chalk.green(mintReceipt.transactionHash))

            const events = mintReceipt.logs[0].events
            let tokenId;

            // Find the event with the type 'wasm'
            for (const event of events) {
                if (event.type === 'wasm') {
                    // Find the attribute with the key 'collection'
                    for (const attribute of event.attributes) {
                        if (attribute.key === 'token_id') {
                            tokenId = attribute.value;
                        }
                    }
                }
            }

            console.log("Token ID: " + chalk.green(tokenId))
        })


    program
        .command("view")
        .description("View information about an existing NFT collection")
        .argument("<collection_address>")
        .action(async (collection) => {
            let spinner = ora("Fetching collection information").start()

            let config = loadConfig()


            const client = await SigningCosmWasmClient.connect(config.rpc)
            client.queryContractSmart(LIGHTHOUSE_CONTRACT, { get_collection: { collection } }).then((result) => {
                spinner.succeed("Collection information fetched")

                let groups = result.mint_groups.map((group: any) => {
                    return {
                        name: group.name,
                        merkle_root: group.merkle_root ? Buffer.from(group.merkle_root).toString('hex') : null,
                        max_tokens: group.max_tokens,
                        unit_price: (new BigNumber(group.unit_price).dividedBy(new BigNumber(1e6))).toString(),
                        start_time: group.start_time ? new Date(group.start_time * 1000).toISOString() : null,
                        end_time: group.end_time ? new Date(group.end_time * 1000).toISOString() : null,
                        creators: group.creators ? group.creators : [],
                    }
                })

                result.mint_groups = groups
                console.log(JSON.stringify(result, null, 4))
            })
        })

    program
        .command("update")
        .description("Update configuration of an existing NFT collection")
        .argument("<collection>")
        .option("--gas-price <gas_price>", "Gas price to use for transaction  (default: 0.1)")
        .action(async (collection, options) => {

            //load config
            let config = loadConfig()

            const wallet = await DirectSecp256k1HdWallet.fromMnemonic(config.mnemonic, {
                prefix: "sei",
            })

            const [firstAccount] = await wallet.getAccounts()

            const client = await SigningCosmWasmClient.connectWithSigner(config.rpc, wallet, {
                gasPrice: GasPrice.fromString(options.gasPrice ? options.gasPrice + "usei" : "0.1usei")
            })

            let spinner = ora("Updating collection").start()

            let token_uri = config.token_uri
            if (token_uri[token_uri.length - 1] === "/")
                token_uri = token_uri.slice(0, -1)

            const updateMsg = {
                update_collection: {
                    collection,
                    name: config.name,
                    symbol: config.symbol,
                    supply: config.supply,
                    token_uri,
                    royalty_percent: config.royalty_percent,
                    royalty_wallet: config.royalty_wallet,
                    iterated_uri: config.iterated_uri ? config.iterated_uri : false,
                    start_order: config.start_order ? config.start_order : null,
                    mint_groups: config.groups.map((group: any) => {
                        return {
                            name: group.name,
                            merkle_root: group.merkle_root ? Array.from(Buffer.from(group.merkle_root, 'hex')) : null,
                            max_tokens: group.max_tokens ? group.max_tokens : 0,
                            unit_price: (new BigNumber(group.unit_price.toString()).times(new BigNumber(1e6))).toString(),
                            creators: group.creators ? group.creators : [],
                            start_time: group.start_time ? new Date(group.start_time).getTime() / 1000 : 0,
                            end_time: group.end_time ? new Date(group.end_time).getTime() / 1000 : 0
                        }
                    })
                }
            }

            const updateReceipt = await client.execute(firstAccount.address, LIGHTHOUSE_CONTRACT, updateMsg, "auto")

            spinner.succeed("Collection updated")
            console.log("Transaction hash: " + chalk.green(updateReceipt.transactionHash))

        })

    program
        .command("deploy")
        .description("Deploy a new NFT collection to the SEI blockchain")
        .option("--code <code_id>", "Register already deployed CW721 contract (optional)")
        .option("--gas-price <gas_price>", "Gas price to use for transaction  (default: 0.1)")
        .action(async (answers) => {


            let codeId = answers.code ? answers.code : null

            //load config
            let config = loadConfig()


            const wallet = await DirectSecp256k1HdWallet.fromMnemonic(config.mnemonic, {
                prefix: "sei",
            })

            const [firstAccount] = await wallet.getAccounts()

            var client = await SigningCosmWasmClient.connectWithSigner(config.rpc, wallet, {
                gasPrice: GasPrice.fromString(answers.gasPrice ? answers.gasPrice + "usei" : "0.1usei")
            })

            let spinner;

            if (codeId === null) {
                let spinner = ora("Deploying CW721 Contract").start()


                const contractPath = path.join(__dirname, "./cw2981_lighthouse_edition.wasm")
                const wasm = fs.readFileSync(contractPath)
                const uploadReceipt = await client.upload(firstAccount.address, wasm, "auto")
                codeId = uploadReceipt.codeId

                spinner.succeed("CW721 Contract deployed to SEI blockchain. Contract Code ID: " + chalk.green(codeId.toString()))
            } else {
                codeId = parseInt(codeId)
                console.log("Using existing CW721 contract with code ID: " + chalk.green(codeId.toString()))
            }

            let token_uri = config.token_uri
            if (token_uri[token_uri.length - 1] === "/")
                token_uri = token_uri.slice(0, -1)

            const registerMsg = {
                register_collection: {
                    cw721_code: codeId,
                    name: config.name,
                    symbol: config.symbol,
                    supply: config.supply,
                    token_uri,
                    royalty_percent: config.royalty_percent,
                    royalty_wallet: config.royalty_wallet,
                    iterated_uri: config.iterated_uri ? config.iterated_uri : false,
                    start_order: config.start_order ? config.start_order : null,
                    frozen: config.frozen ? config.frozen : false,
                    hidden_metadata: config.hidden_metadata ? config.hidden_metadata : false,
                    placeholder_token_uri: config.placeholder_token_uri ? config.placeholder_token_uri : null,
                    mint_groups: config.groups.map((group: any) => {
                        return {
                            name: group.name,
                            merkle_root: group.merkle_root ? Array.from(Buffer.from(group.merkle_root, 'hex')) : null,
                            max_tokens: group.max_tokens ? group.max_tokens : 0,
                            unit_price: (new BigNumber(group.unit_price.toString()).times(new BigNumber(1e6))).toString(),
                            creators: group.creators ? group.creators : [],
                            start_time: group.start_time ? new Date(group.start_time).getTime() / 1000 : 0,
                            end_time: group.end_time ? new Date(group.end_time).getTime() / 1000 : 0
                        }
                    })
                }
            }

            spinner = ora("Registering Collection").start()

            const registerReceipt = await client.execute(firstAccount.address, LIGHTHOUSE_CONTRACT, registerMsg, "auto")

            spinner.succeed("Collection registered to Lighthouse")

            const events = registerReceipt.logs[0].events
            let collectionAddress;

            // Find the event with the type 'wasm'
            for (const event of events) {
                if (event.type === 'wasm') {
                    // Find the attribute with the key 'collection'
                    for (const attribute of event.attributes) {
                        if (attribute.key === 'collection') {
                            collectionAddress = attribute.value;
                        }
                    }
                }
            }

            console.log("Transaction hash: " + chalk.green(registerReceipt.transactionHash))
            console.log("Collection address: " + chalk.green(collectionAddress))
        })

    program
        .command("unfreeze")
        .description("Unfreeze a collection")
        .argument("<collection>")
        .option("--gas-price <gas_price>", "Gas price to use for transaction  (default: 0.1)")
        .action(async (collection, options) => {
            
            let config = loadConfig()

            const wallet = await DirectSecp256k1HdWallet.fromMnemonic(config.mnemonic, {
                prefix: "sei",
            })
            const [firstAccount] = await wallet.getAccounts()

            const client = await SigningCosmWasmClient.connectWithSigner(config.rpc, wallet, {
                gasPrice: GasPrice.fromString(options.gasPrice ? options.gasPrice + "usei" : "0.1usei")
            })

            let spinner = ora("Unfreezing collection").start()
            const Msg = {
                unfreeze_collection: { collection }
            }

            const txReceipt = await client.execute(firstAccount.address, LIGHTHOUSE_CONTRACT, Msg, "auto", "",)

            spinner.succeed("Collection unfrozen")
            console.log("Transaction hash: " + chalk.green(txReceipt.transactionHash))

        })

    program
        .command("update-hidden-metadata")
        .description("Update placeholder metadata of hidden frozen collection")
        .arguments("<collection> <metadata-url>")
        .option("--gas-price <gas_price>", "Gas price to use for transaction  (default: 0.1)")
        .action(async (collection, metadata, options) => {

            let config = loadConfig()

            const wallet = await DirectSecp256k1HdWallet.fromMnemonic(config.mnemonic, {
                prefix: "sei",
            })
            const [firstAccount] = await wallet.getAccounts()

            const client = await SigningCosmWasmClient.connectWithSigner(config.rpc, wallet, {
                gasPrice: GasPrice.fromString(options.gasPrice ? options.gasPrice + "usei" : "0.1usei")
            })

            let spinner = ora("Updating").start()
            const Msg = {
                update_reveal_collection_metadata: { collection, placeholder_token_uri: metadata }
            }

            const txReceipt = await client.execute(firstAccount.address, LIGHTHOUSE_CONTRACT, Msg, "auto", "",)

            spinner.succeed("Update complete")
            console.log("Transaction hash: " + chalk.green(txReceipt.transactionHash))

        })

    program
        .command("reveal")
        .description("Reveal a collection")
        .argument("<collection>")
        .option("--gas-price <gas_price>", "Gas price to use for transaction  (default: 0.1)")
        .action(async (collection, options) => {

            let config = loadConfig()

            const wallet = await DirectSecp256k1HdWallet.fromMnemonic(config.mnemonic, {
                prefix: "sei",
            })
            const [firstAccount] = await wallet.getAccounts()

            const client = await SigningCosmWasmClient.connectWithSigner(config.rpc, wallet, {
                gasPrice: GasPrice.fromString(options.gasPrice ? options.gasPrice + "usei" : "0.1usei")
            })

            let spinner = ora("Revealing Metadata").start()
            const Msg = {
                reveal_collection_metadata: { collection }
            }

            const txReceipt = await client.execute(firstAccount.address, LIGHTHOUSE_CONTRACT, Msg, "auto", "",)

            spinner.succeed("Metadata revealed")
            console.log("Transaction hash: " + chalk.green(txReceipt.transactionHash))

        })

    program
        .command("ownerof")
        .description("Get the owner of a token")
        .arguments("<collection> <token_ids>")
        .action(async (collection, token_ids) => {

            let spinner = ora("Fetching owner information").start()

            let config = loadConfig()

            const client = await SigningCosmWasmClient.connect(config.rpc)

            let owners = []

            for (let token_id of token_ids.split(",")) {

                let result = await client.queryContractSmart(collection, {
                    owner_of: {
                        token_id
                    }
                })

                owners.push(result.owner)
            }

            spinner.succeed("Owners fetched")
            console.log(owners.join("\n"))

            //ask to save to file
            const answers = await inquirer.prompt([{
                type: 'confirm',
                name: 'save',
                message: 'Save owners to a file?',
                default: false
            }])

            if (answers.save) {
                const answers = await inquirer.prompt([{
                    type: 'input',
                    name: 'file',
                    message: 'Enter file name',
                    default: "owners.txt"
                }])
                fs.writeFileSync(answers.file, owners.join("\n"))
            }

        })

    program
        .command("minterof")
        .description("Get the minter of token(s)")
        .argument("<collection>", "Collection address")
        .argument("<token_ids>", "Token ID(s) separated by commas")
        .action(async (collection, token_ids) => {

            let spinner = ora("Fetching Minter information").start()

            let config = loadConfig()

            const client = await SigningCosmWasmClient.connect(config.rpc)

            let minters = []

            for (let token_id of token_ids.split(",")) {

                let result = await client.queryContractSmart(LIGHTHOUSE_CONTRACT, {
                    get_minter_of: {
                        collection,
                        token_id
                    }
                })

                minters.push({ token_id, minter: result })
            }

            spinner.succeed("Minters fetched")
            console.log(minters.map((minter: any) => minter.token_id + " " + minter.minter).join("\n"))

            //ask to save to file
            const answers = await inquirer.prompt([{
                type: 'confirm',
                name: 'save',
                message: 'Save minters to a file?',
                default: false
            }])

            if (answers.save) {
                const answers = await inquirer.prompt([{
                    type: 'input',
                    name: 'file',
                    message: 'Enter file name',
                    default: "minters.txt"
                }])
                fs.writeFileSync(answers.file, minters.map((minter: any) => minter.token_id + " " + minter.minter).join("\n"))
            }

        })

    program
        .command("mintersof")
        .description("Get all minters of a collection")
        .argument("<collection>", "Collection address")
        .action(async (collection) => {

            let spinner = ora("Fetching Minter information").start()

            let config = loadConfig()

            const client = await SigningCosmWasmClient.connect(config.rpc)
            let collectionData = await client.queryContractSmart(LIGHTHOUSE_CONTRACT, { get_collection: { collection } })

            let minters = []

            for (let i = 0; i < collectionData.supply; i++) {

                let result = await client.queryContractSmart(LIGHTHOUSE_CONTRACT, {
                    get_minter_of: {
                        collection,
                        token_id: (i + collectionData.start_order).toString()
                    }
                })

                minters.push({ token_id: (i + collectionData.start_order).toString(), minter: result })
            }

            spinner.succeed("Minters fetched")
            console.log(minters.map((minter: any) => minter.token_id + " " + minter.minter).join("\n"))

            //ask to save to file
            const answers = await inquirer.prompt([{
                type: 'confirm',
                name: 'save',
                message: 'Save minters to a file?',
                default: false
            }])

            if (answers.save) {
                const answers = await inquirer.prompt([{
                    type: 'input',
                    name: 'file',
                    message: 'Enter file name',
                    default: "minters.txt"
                }])
                fs.writeFileSync(answers.file, minters.map((minter: any) => minter.token_id + " " + minter.minter).join("\n"))
            }

        })


    program
        .command("view-nft")
        .description("View NFT information")
        .arguments("<collection> <token_id>")
        .action(async (collection, token_id) => {

            let spinner = ora("Fetching NFT information").start()

            let config = loadConfig()

            const client = await SigningCosmWasmClient.connect(config.rpc)

            let result = await client.queryContractSmart(collection, {
                nft_info: {
                    token_id
                }
            })

            spinner.succeed("NFT fetched")
            console.log(result)

        })

    program
        .command("transfer-nft")
        .description("Transfer NFT")
        .arguments("<collection> <token_id> <to>")
        .option("--gas-price <gas_price>", "Gas price to use for transaction  (default: 0.1)")
        .action(async (collection, tokenId, to, options) => {

            let config = loadConfig()

            const wallet = await DirectSecp256k1HdWallet.fromMnemonic(config.mnemonic, {
                prefix: "sei",
            })
            const [firstAccount] = await wallet.getAccounts()

            const client = await SigningCosmWasmClient.connectWithSigner(config.rpc, wallet, {
                gasPrice: GasPrice.fromString(options.gasPrice ? options.gasPrice + "usei" : "0.1usei")
            })

            let spinner = ora("Transferring NFT").start()
            const transferMsg = {
                transfer_nft: {
                    recipient: to,
                    token_id: tokenId
                }
            }

            const txReceipt = await client.execute(firstAccount.address, collection, transferMsg, "auto", "",)

            spinner.succeed("NFT minted")
            console.log("Transaction hash: " + chalk.green(txReceipt.transactionHash))

        })


    program
        .command("list", { hidden: true })
        .option("--start-after <start_after>", "Start listing after this address")
        .option("--limit <limit>", "Limit the number of results")
        .option("--result-type <result_type>", "Result type (full or minimal)")
        .action(async (answers) => {

            let spinner = ora("Fetching collections information").start()

            let config = loadConfig()

            let start_after = answers.startAfter || null
            let limit = answers.limit || null
            let result_type = answers.resultType || null


            const client = await SigningCosmWasmClient.connect(config.rpc)
            client.queryContractSmart(LIGHTHOUSE_CONTRACT, {
                get_collections: {
                    start_after,
                    limit: limit ? parseInt(limit) : null,
                    result_type
                }
            }).then((result) => {
                spinner.succeed("Collections fetched")

                if (result_type === "full") {

                    for (let i = 0; i < result.collections.length; i++) {
                        let groups = result.collections[i].mint_groups.map((group: any) => {
                            return {
                                name: group.name,
                                merkle_root: group.merkle_root ? Buffer.from(group.merkle_root).toString('hex') : null,
                                max_tokens: group.max_tokens,
                                unit_price: (new BigNumber(group.unit_price).dividedBy(new BigNumber(1e6))).toString(),
                                start_time: group.start_time ? new Date(group.start_time * 1000).toISOString() : null,
                                end_time: group.end_time ? new Date(group.end_time * 1000).toISOString() : null
                            }
                        })

                        result.collections[i].mint_groups = groups
                    }

                    console.log(JSON.stringify(result.collections, null, 4))
                } else {
                    console.log(JSON.stringify(result.collections, null, 4))
                }
            })

        });



    program.parse()
}

const createDefaultConfig = () => {

    inquirer.prompt([
        {
            type: "input",
            name: "name",
            message: "What is the name of your project?"
        },
        {
            type: "input",
            name: "symbol",
            message: "What is the symbol of your project?"
        },
        {
            type: "input",
            name: "supply",
            message: "What is the total supply of your project?"
        },
        {
            type: "input",
            name: "royalty_percentage",
            message: "What is the royalty percentage of your project?"
        },
        {
            type: "input",
            name: "royalty_wallet",
            message: "Creator wallet address to receive royalties?"
        },
        {
            type: "input",
            name: "creator_wallet",
            message: "Creator wallet address to receive mint funds?"
        },
        {
            type: "input",
            name: "wallet",
            message: "What is the mnemonic keyphrase of the address you want to use in lighthouse?"
        },
        {
            type: "input",
            name: "rpc",
            message: "What is the RPC you want to use"
        },
        {
            type: "list",
            name: "network",
            message: "What is the network you want to use?",
            choices: ['atlantic-2']
        }
    ]).then(async (answers) => {

        let config = {
            mnemonic: answers.wallet,
            rpc: answers.rpc,
            network: answers.network,
            name: answers.name,
            symbol: answers.symbol,
            description: "",
            supply: parseInt(answers.supply),
            token_uri: "",
            royalty_percent: parseFloat(answers.royalty_percentage),
            royalty_wallet: answers.royalty_wallet,
            iterated_uri: true,
            start_order: 1,
            frozen: false,
            hidden_metadata: false,
            placeholder_token_uri: null,
            groups: [
                {
                    name: "public",
                    merkle_root: null,
                    max_tokens: 0,
                    unit_price: 1,
                    creators: [
                        {
                            address: answers.creator_wallet,
                            share: 100
                        }
                    ],
                    start_time: new Date().toISOString().split(".")[0] + "Z",
                    end_time: null
                }
            ],
        }

        fs.writeFileSync("./config.json", JSON.stringify(config, null, 4))

        console.log(chalk.green("Created config.json"))
    })

}

main();

