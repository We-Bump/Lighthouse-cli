
# Lighthouse

Lighthouse is a powerful command line interface tool designed to facilitate the interaction with Non-Fungible Tokens (NFTs) on the SEI blockchain. It allows users to easily update and deploy NFT collections.

## Features

- Deploy NFT collections with royalty option
- Update NFT collections
- Freeze/Unfreeze trading of NFT collections
- Reveal metadata of NFT collections
- View NFT collections
- Mint NFTs
- Generate merkle root for allowlists
- Generate merkle proof for a wallet
- Upload metadata and image files to upload to arweave


## Installion

From your command line:
```bash
# Install lighthouse globally
$ npm install -g @we-bump/lighthouse-cli

# Run the app
$ lighthouse
```

## Compile Source Code

From your command line:
```bash
# Clone this repository 
$ git clone https://github.com/We-Bump/Lighthouse-cli

# Go into the repository
$ cd Lighthouse-cli

# Install dependencies
$ npm install

# Install ts-node globally
$ npm install -g ts-node

# Run the app
$ ts-node lightouse.ts
```

## Usage


### `init`

Init a new project configuration. It will ask you several questions about your project (name, symbol, total supply, etc.) and generate a configuration file (`config.json`) based on your answers.
```sh
$ lighthouse init
```
### `load-wallet`

Load a wallet with mnemonic keyphrase. 

```sh
$ lighthouse load-wallet
```
### `load-rpc`

Load rpc to use in cli.

```sh
$ lighthouse load-rpc
```
### `load-network`

Select network to use in cli.

```sh
$ lighthouse load-network
```
### `deploy`

Deploy a new NFT collection based on (`config.json`) . 
```
$ lighthouse deploy
```
##### options
If you have already deployed a CW2981 contract and not registerd it to Lighthouse, you can register it using the `--code` option.
```sh
--code <code-id>
```
### `update <collection>`

Update the configuration of an existing NFT collection. You need to provide the name of the collection as a command argument.
```
$ lighthouse update <collection-address>
```
### `unfreeze`

Unfreeze trading of a collection.
```
$ lighthouse unfreeze <collection-address>
```

### `update-hidden-metadata`

Update placeholder metadata of hidden frozen collection
```
$ lighthouse update-hidden-metadata <collection-address> <placeholder-token-uri>
```

### `reveal`

Reveal metadata of a collection
```
$ lighthouse reveal <collection-address>
```
### `view`

View configuration of a deployed NFT collection.
```
$ lighthouse view <collection-address>
```
### `mint`

Mint single nft on a deployed NFT collection.
```
$ lighthouse mint <collection-address> <group_name>
```
### `generate-merkle-root`

Generate a merkle root for allowlists.
```
$ lighthouse generate-merkle-root <path-to-wallets-json-file>
```
### `generate-merkle-proof`

Generate merkle proof for a walet.
```
$ lighthouse generate-merkle-root <path-to-wallets-json-file> <publickey>
```
### `ownerof`

Get owner(s) of specific token ids.
```
$ lighthouse ownerof <collection-address> <token-ids>
```
### `minterof`

Get the minter of token(s)
```
$ lighthouse minterof <collection-address> <token-ids>
```
### `mintersof`

Get all minters of a collection
```
$ lighthouse mintersof <collection-address>
```

### `validate`

Validate metadata and image files to upload to arweave. `(metadata files must be in ./assets folder)`
```
$ lighthouse validate
```
### `upload`

Upload metadata and image files to upload to arweave. `(metadata files must be in ./assets folder)`
```
$ lighthouse upload
```
##### options
Path to Arweave wallet
```sh
--wallet <wallet>
```
Arweave node url `optional` `(default https://arweave.net)`
```
--url <url>
```

## Configuration

Lighthouse relies on a `config.json` file for configuration of NFT collections. If the file does not exist, the CLI will automatically guide you through creating a default one.
```json
{
  "mnemonic": "your mnemonic keyphrase",
  "rpc": "rpc url",
  "network": "atlantic-2",
  "name": "collection-name",
  "symbol": "collection-symbol",
  "description": "",
  "supply": 1000,
  "token_uri": "",
  "royalty_percent": 5,
  "royalty_wallet": "royalty-wallet-address",
  "iterated_uri":true,
  "start_order": 1,
  "frozen": false,
  "hidden_metadata": false,
  "placeholder_token_uri": "",
  "groups": [
    {
      "name": "whitelist",
      "merkle_root": "dcd038eeec4c67d44de097df2d773179fa811948a2e391f9784f6823a29c4a9f",
      "max_tokens": 3,
      "unit_price": 0.5,
      "creators": [
          {
              "address": "creator-wallet-address",
              "share": 100
          }
      ],
      "start_time": "2023-05-30T08:00:00Z",
      "end_time": "2023-05-30T09:00:00Z"
    },
    {
      "name": "public",
      "merkle_root": null,
      "max_tokens": 10,
      "unit_price": 1,
      "creators": [
          {
              "address": "creator-wallet-address",
              "share": 100
          }
      ],
      "start_time": "2023-05-30T09:00:00Z",
      "end_time": null
    }
  ]
}
```
`mnemonic` - memonic keyphrase to use in the Lighthouse

`rpc` - rpc url of the blockchain

`network` - network name

`name` - name of the collection

`symbol` - symbol of the collection

`supply` - supply of the collection

`token_uri` - base token url of the collection

> token url is used for giving every nft a metadata url. nft urls are determined like this: {token_uri}/{nft_token_id}

`royalty_percent` - royalty percent on every sale

`royalty_wallet` - wallet to receive royalty

`iterated_uri` - should disable token_uri generate for iterated urls or not (eg: {token_uri}/1, {token_uri}/2, ...) 
(if set to true every nft will have same metadata url and if set to false every nft will have different metadata url)

`start_order` - start token id of the collection (default: 0)

`frozen` - should the trading be frozen or not (default: false) (can only freezed while deploying and can't be freezed after deployed) 

`hidden_metadata` - should the metadata be hidden and replaced with "placeholder_token_uri" or not (default: false) (can only be hidden while deploying and can't be hidden after deployed)

`placeholder_token_uri` - placeholder token url to use for every nft's metadata if "hidden_metadata" is set to true

`groups` - array of mint groups

##### group options

`name` - group name

`merkle_root` - merkle root to restrict minting to only allowlisted wallets

`max_tokens` - max mint per wallet

`unit_price` - mint price

`creators` - array of creators and their share in mint funds (total share must be 100)

`start_time` - start time of minting to start for the group (utc)

`end_time` - end time of mint (utc)


## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

### Note

While minting, minters have to pay 5 $SEI for Lighthouse platform fee on every minted nft. (if mint is free, no fee will be charged)