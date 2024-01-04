import Arweave from "arweave"
import Transaction from "arweave/node/lib/transaction"
import crypto from "crypto"
import ora from "ora"
import inquirer from "inquirer"
import chalk from "chalk"
import fs from "fs"
import { saveLogs } from "./lighthouse"

const MAX_RETRIES = 3;

export const createArTx = async (arweave: Arweave, data: Buffer, wallet: any, contentType: string) => {

    let tags = new Tags()
    tags.addTag('Content-Type', contentType)
    tags.addTag('User-Agent', "lighthouse")
    tags.addTag('User-Agent-Version', "0.3.7")
    tags.addTag('Type', 'file')
    tags.addTag('File-Hash', hashFile(data))

    let tx = await arweave.createTransaction({ data }, wallet)
    tags.addTagsToTransaction(tx)

    return tx
}

export const signArTx = async (arweave: Arweave, tx: Transaction, wallet: any) => {
    await arweave.transactions.sign(tx, wallet)
    return tx
}

export const submitArTx = async (arweave: Arweave, tx: Transaction) => new Promise(async (resolve, reject) => {
    let uploader = await arweave.transactions.getUploader(tx)
    try {
        while (!uploader.isComplete) {
            await uploader.uploadChunk()
        }
    } catch (err) {
        if (uploader.lastResponseStatus > 0) {
            return reject({
                status: uploader.lastResponseStatus,
                statusText: uploader.lastResponseError,
            })
        }
    }

    resolve(tx.id)
})

export interface manifestData {
    txid: string,
    path: string,
}

export const createManifestTx = async (arweave: Arweave, txs: manifestData[], wallet: any) => {
    let paths: any = {}

    txs.forEach(({ txid, path }) => {
        paths[path] = { id: txid }
    })

    const data = {
        manifest: 'arweave/paths',
        version: '0.1.0',
        index: {
            path: "-1",
        },
        paths,
    }

    let tx = await arweave.createTransaction(
        {
            data: JSON.stringify(data),
        },
        wallet,
    )

    let tags = new Tags()
    tags.addTag('Type', 'manifest')
    tags.addTag('Content-Type', 'application/x.arweave-manifest+json')
    tags.addTagsToTransaction(tx)

    return tx
}

class Tags {
    _tags = new Map();

    constructor() {
        this._tags = new Map();
    }
    get tags() {
        return Array.from(this._tags.entries()).map(([name, value]) => ({ name, value }));
    }
    addTag(key: any, value: any) {
        this._tags.set(key, value);
    }
    addTags(tags: any) {
        tags.forEach(({ name, value }: any) => this.addTag(name, value));
    }
    addTagsToTransaction(tx: Transaction) {
        this.tags.forEach(({ name, value }) => tx.addTag(name, value));
    }
}

const hashFile = (data: Buffer) => {
    const hash = crypto.createHash('sha256')
    hash.update(data)
    return hash.digest('hex')
}

export const contentTypeOf = (name: string) => {
    //for images
    if (name.endsWith(".png")) return "image/png"
    if (name.endsWith(".jpg")) return "image/jpeg"
    if (name.endsWith(".jpeg")) return "image/jpeg"
    if (name.endsWith(".gif")) return "image/gif"
    if (name.endsWith(".svg")) return "image/svg+xml"
    if (name.endsWith(".webp")) return "image/webp"
    if (name.endsWith(".bmp")) return "image/bmp"
    if (name.endsWith(".ico")) return "image/vnd.microsoft.icon"
    if (name.endsWith(".tiff")) return "image/tiff"
    if (name.endsWith(".tif")) return "image/tiff"
    if (name.endsWith(".avif")) return "image/avif"
    if (name.endsWith(".apng")) return "image/apng"
    if (name.endsWith(".jfif")) return "image/jpeg"
    if (name.endsWith(".pjpeg")) return "image/jpeg"
    if (name.endsWith(".pjp")) return "image/jpeg"

    return "application/octet-stream"
}

export const processCliUpload = async (answers: any) => {
    //get wallet
    let walletPath = answers.wallet ? answers.wallet : null
    if (!answers.wallet) {
        let response = await inquirer.prompt([
            {
                type: "input",
                name: "wallet",
                message: "Path to arweave keypair JSON file",
            }
        ])
        walletPath = response.wallet
    }

    //arrange host
    let host = answers.url ? answers.url : ""
    let port = ""
    let protocol = ""
    let fullurl = answers.url ? answers.url : ""
    if (host) {
        if (host.startsWith("https://")) {
            port = "443"
            protocol = "https"
            host = host.split("https://")[1]
            //remove port from host if exists
            if (host.indexOf(":") !== -1)
                host = host.split(":")[0]
        } else if (host.startsWith("http://")) {
            protocol = "http"

            //if host has a port
            if (host.indexOf(":") !== -1)
                port = host.split(":")[2]
            else
                port = "80"

            host = host.split("http://")[1]
            //remove port from host if exists
            if (host.indexOf(":") !== -1)
                host = host.split(":")[0]

        } else
            return console.log(chalk.red("Invalid url"))

        if (fullurl.endsWith("/"))
            fullurl = fullurl.substring(0, fullurl.length - 1)
    } else {
        host = "arweave.net"
        port = "443"
        protocol = "https"
        fullurl = "https://arweave.net"
    }

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

    spinner.succeed("Files validated")

    //init arweave
    let arweave = Arweave.init({
        host,
        port,
        protocol,
    })

    //logs
    let logs: any = []

    //setup cache
    let cache: any = {
        images: [],
        metadata: [],
        imagesManifest: "",
        metadataManifest: ""
    }

    //if cache exists, load it
    if (fs.existsSync("./cache.json")) {
        let cachefile = JSON.parse(fs.readFileSync("./cache.json", "utf-8"))

        //ask if use cache
        let useCache = await inquirer.prompt([
            {
                type: "confirm",
                name: "useCache",
                message: "Would you like to use the cache file for previous content?",
                default: true
            }
        ])

        if (useCache.useCache) {
            cache = cachefile
            //check if cache is valid
            if (!Array.isArray(cache.images) || !Array.isArray(cache.metadata) || typeof cache.imagesManifest !== "string" || typeof cache.metadataManifest !== "string") {
                spinner.fail("Invalid cache file")
                return
            }
        }
    }

    //load wallet
    let wallet = JSON.parse(fs.readFileSync(walletPath, "utf-8"))

    //calculate cost
    let totalSize = 0
    for (let file of files) {
        let metadata = JSON.parse(fs.readFileSync("./assets/" + file, "utf-8"))
        let metadataFileSize = Buffer.from(JSON.stringify(metadata)).length
        let imageFileSize = fs.statSync("./assets/" + metadata.image).size

        if (cache.metadata.filter((m: any) => m.name === file.split(".json")[0]).length > 0)
            metadataFileSize = 0

        if (cache.images.filter((image: any) => image.name === metadata.image).length > 0)
            imageFileSize = 0

        totalSize += metadataFileSize + imageFileSize
    }

    let cost = await arweave.transactions.getPrice(totalSize)
    let constInAr = arweave.ar.winstonToAr(cost)

    //ask for confirmation
    let confirm = await inquirer.prompt([
        {
            type: "confirm",
            name: "confirm",
            message: "This will cost ~" + constInAr + " AR. Continue?",
            default: true
        }
    ])

    if (!confirm.confirm)
        return

    //check balance
    let address = await arweave.wallets.jwkToAddress(wallet)
    let balance = await arweave.wallets.getBalance(address)

    if (BigInt(balance) < BigInt(cost)) {
        spinner.fail("Insufficient AR balance")
        return
    }

    //log failed 
    let failedImages = []
    let failedMetadata = []

    spinner = ora("Uploading images").start()
    let counter = 0
    //upload images
    for (let i = 0; i < files.length; i++) {
        let retryCount = 0;
        let file = files[i]
        let metadata = JSON.parse(fs.readFileSync("./assets/" + file, "utf-8"))

        //if metadata.image is not in cache.images, upload it
        if (cache.images.filter((image: any) => image.name === metadata.image).length > 0) {
            continue
        }

        let image = fs.readFileSync("./assets/" + metadata.image)

        while (retryCount < MAX_RETRIES) {
            try {
                let tx = await createArTx(arweave, image, wallet, contentTypeOf(metadata.image))
                tx = await signArTx(arweave, tx, wallet)

                await submitArTx(arweave, tx)
                cache.images.push({
                    name: metadata.image,
                    txid: tx.id
                })

                counter++
                spinner.text = "Uploading images (" + counter + "/" + files.length + ") - (failed: " + failedImages.length + ")"
                break;
            } catch (e: any) {
                try {
                    if (e.message && e.message.indexOf("429") !== -1) {
                        let waitTime = (2 ** retryCount) * 60000; // Exponential backoff
                        spinner.text = `Rate limit reached, waiting ${waitTime / 60000} minutes`;
                        await delay(waitTime);
                        retryCount++;
                    } else {
                        failedImages.push(metadata.image);
                        counter++;
                        spinner.text = "Uploading images (" + counter + "/" + files.length + ") - (failed: " + failedImages.length + ")";

                        logs.push({
                            type: "error",
                            message: "Failed to upload image " + metadata.image,
                            error: e
                        });
                        break;
                    }
                } catch (e) {
                    failedImages.push(metadata.image);
                    counter++;
                    spinner.text = "Uploading images (" + counter + "/" + files.length + ") - (failed: " + failedImages.length + ")";

                    logs.push({
                        type: "error",
                        message: "Failed to upload image " + metadata.image,
                        error: e
                    });
                    break;
                }
            }

            // If the retry count has reached the maximum, log the failure and stop the CLI
            if (retryCount === MAX_RETRIES) {
                logs.push({
                    type: "fatal",
                    message: `Failed to upload image ${metadata.image} after ${MAX_RETRIES} retries.`,
                    error: `Error 429: Too Many Requests`
                });

                // Save logs before exiting
                saveLogs(logs);

                //save cache  before exiting
                fs.writeFileSync("./cache.json", JSON.stringify(cache, null, 4))

                throw new Error(`Failed to upload image ${metadata.image} after ${MAX_RETRIES} retries. (429)`);
            }
        }
    }

    spinner.succeed("Images complete")

    //save cache
    fs.writeFileSync("./cache.json", JSON.stringify(cache, null, 4))

    //save logs
    saveLogs(logs)

    if (failedImages.length > 0) {
        console.log(chalk.red("Failed to upload " + failedImages.length + " images"))
        console.log()

        console.log("re run upload command to upload failed images")
        return
    }

    spinner = ora("Creating images manifest").start()

    //create images manifest
    if (cache.imagesManifest === "") {
        let manifest: manifestData[] = []
        for (let image of cache.images) {
            manifest.push({
                txid: image.txid,
                path: image.name
            })
        }

        try {
            let manifestTx = await createManifestTx(arweave, manifest, wallet)
            manifestTx = await signArTx(arweave, manifestTx, wallet)
            await submitArTx(arweave, manifestTx)
            cache.imagesManifest = manifestTx.id
        } catch (e) {
            spinner.fail("Failed to upload images manifest")
            console.log("re run upload command to upload retry")

            logs.push({
                type: "error",
                message: "Failed to upload image manifest",
                error: e
            })

            saveLogs(logs)
            return
        }
    }

    spinner.succeed("Images manifest uploaded")

    spinner = ora("Uploading metadata").start()
    counter = 0

    //save cache
    fs.writeFileSync("./cache.json", JSON.stringify(cache, null, 4))

    //upload metadata
    for (let i = 0; i < files.length; i++) {
        let retryCount = 0;
        let file = files[i]
        let metadata = JSON.parse(fs.readFileSync("./assets/" + file, "utf-8"))
        //replace image with imagesManifest + txid
        metadata.image = fullurl + "/" + cache.imagesManifest + "/" + metadata.image

        //if metadata is not in cache.metadata, upload it
        if (cache.metadata.filter((m: any) => m.name === file.split(".json")[0]).length > 0) {
            continue
        }

        while (retryCount < MAX_RETRIES) {
            try {
                let tx = await createArTx(arweave, Buffer.from(JSON.stringify(metadata)), wallet, "application/json")
                tx = await signArTx(arweave, tx, wallet)

                await submitArTx(arweave, tx)
                cache.metadata.push({
                    name: file.split(".json")[0],
                    txid: tx.id
                })

                counter++
                spinner.text = "Uploading metadata (" + counter + "/" + files.length + ") - (failed: " + failedMetadata.length + ")"
                break;
            } catch (e: any) {
                try {
                    if (e.message && e.message.indexOf("429") !== -1) {
                        let waitTime = (2 ** retryCount) * 60000; // Exponential backoff
                        spinner.text = `Rate limit reached, waiting ${waitTime / 60000} minutes`;
                        await delay(waitTime);
                        retryCount++;
                    } else {
                        failedMetadata.push(file)
                        counter++
                        spinner.text = "Uploading metadata (" + counter + "/" + files.length + ") - (failed: " + failedMetadata.length + ")"

                        logs.push({
                            type: "error",
                            message: "Failed to upload metadata " + file,
                            error: e
                        })
                        break;
                    }
                } catch (e) {
                    failedMetadata.push(file)
                    counter++
                    spinner.text = "Uploading metadata (" + counter + "/" + files.length + ") - (failed: " + failedMetadata.length + ")"

                    logs.push({
                        type: "error",
                        message: "Failed to upload metadata " + file,
                        error: e
                    })
                    break;
                }
            }
        }

        // If the retry count has reached the maximum, log the failure and stop the CLI
        if (retryCount === MAX_RETRIES) {
            logs.push({
                type: "fatal",
                message: `Failed to upload metadata ${counter} after ${MAX_RETRIES} retries.`,
                error: `Error 429: Too Many Requests`
            });

            // Save logs before exiting
            saveLogs(logs);

            //save cache  before exiting
            fs.writeFileSync("./cache.json", JSON.stringify(cache, null, 4))

            throw new Error(`Failed to upload metadata ${counter} after ${MAX_RETRIES} retries. (429)`);
        }
    }

    spinner.succeed("Metadata complete")

    saveLogs(logs)

    //save cache
    fs.writeFileSync("./cache.json", JSON.stringify(cache, null, 4))

    if (failedMetadata.length > 0) {
        console.log(chalk.red("Failed to upload " + failedMetadata.length + "  metadata files"))

        console.log("re run upload command to upload failed metadatas")
        return
    }

    spinner = ora("Creating metadata manifest").start()

    //create metadata manifest
    let manifest: manifestData[] = []
    for (let metadata of cache.metadata) {
        manifest.push({
            txid: metadata.txid,
            path: metadata.name
        })
    }

    try {
        let manifestTx = await createManifestTx(arweave, manifest, wallet)
        manifestTx = await signArTx(arweave, manifestTx, wallet)
        await submitArTx(arweave, manifestTx)
        cache.metadataManifest = manifestTx.id
    } catch (e) {
        spinner.fail("Failed to upload metadata manifest")
        console.log("re run upload command to retry")

        logs.push({
            type: "error",
            message: "Failed to upload image manifest",
            error: e
        })

        saveLogs(logs)
        return
    }


    spinner.succeed("Metadata manifest uploaded")

    //save cache
    fs.writeFileSync("./cache.json", JSON.stringify(cache, null, 4))

    console.log(chalk.green("Upload complete"))
    //print metadata manifest
    console.log("Root url: " + chalk.green(fullurl + "/" + cache.metadataManifest))

    //ask for save to config
    let save = await inquirer.prompt([
        {
            type: "confirm",
            name: "save",
            message: "Save metadata manifest to config.json?",
            default: true
        }
    ])

    if (save.save) {
        //if config.json exists
        if (fs.existsSync("./config.json")) {
            let config = JSON.parse(fs.readFileSync("./config.json", "utf-8"))
            config.token_uri = fullurl + "/" + cache.metadataManifest
            fs.writeFileSync("./config.json", JSON.stringify(config, null, 4))
        } else {
            //create config.json with token_uri
            let config = {
                token_uri: fullurl + "/" + cache.metadataManifest
            }
            fs.writeFileSync("./config.json", JSON.stringify(config, null, 4))
        }

        console.log(chalk.green("Done!"))
    }
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
