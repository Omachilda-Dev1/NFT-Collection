const { create } = require('ipfs-http-client');
const fs = require('fs');
const path = require('path');

async function uploadToIPFS() {
  // Connect to IPFS (you can use Infura, Pinata, or local node)
  const ipfs = create({
    host: 'ipfs.infura.io',
    port: 5001,
    protocol: 'https',
    headers: {
      authorization: 'Basic ' + Buffer.from(
        process.env.INFURA_PROJECT_ID + ':' + process.env.INFURA_API_SECRET
      ).toString('base64')
    }
  });

  console.log('Uploading metadata to IPFS...\n');

  // Upload hidden metadata
  const hiddenMetadata = fs.readFileSync(path.join(__dirname, 'hidden.json'));
  const hiddenResult = await ipfs.add(hiddenMetadata);
  console.log('Hidden metadata uploaded:', hiddenResult.path);
  console.log('URI: ipfs://' + hiddenResult.path);

  // Upload revealed metadata folder
  const metadataFiles = [];
  for (let i = 0; i < 100; i++) {
    // Generate metadata for each token (you'd customize this)
    const metadata = {
      name: `DeFi NFT #${i}`,
      description: 'A unique NFT from the DeFi NFT Collection with staking capabilities',
      image: `ipfs://QmYourImageHash/${i}.png`,
      attributes: [
        {
          trait_type: 'Rarity',
          value: i < 60 ? 'Common' : i < 90 ? 'Rare' : 'Legendary'
        },
        {
          trait_type: 'Background',
          value: ['Blue', 'Red', 'Green', 'Purple'][i % 4]
        },
        {
          trait_type: 'Character',
          value: ['Warrior', 'Mage', 'Rogue', 'Paladin'][i % 4]
        }
      ]
    };

    metadataFiles.push({
      path: `${i}.json`,
      content: JSON.stringify(metadata, null, 2)
    });
  }

  // Upload all metadata files
  const results = [];
  for await (const result of ipfs.addAll(metadataFiles, { wrapWithDirectory: true })) {
    results.push(result);
    if (result.path === '') {
      console.log('\nMetadata folder uploaded!');
      console.log('Folder CID:', result.cid.toString());
      console.log('Base URI: ipfs://' + result.cid.toString() + '/');
    }
  }

  console.log('\n✅ Upload complete!');
  console.log('\nUse these URIs in your contract:');
  console.log('Hidden URI: ipfs://' + hiddenResult.path);
  console.log('Base URI: ipfs://' + results[results.length - 1].cid.toString() + '/');
}

// Alternative: Using Pinata
async function uploadToPinata() {
  const pinataSDK = require('@pinata/sdk');
  const pinata = new pinataSDK(process.env.PINATA_API_KEY, process.env.PINATA_SECRET_KEY);

  console.log('Uploading to Pinata...\n');

  // Test authentication
  const testAuth = await pinata.testAuthentication();
  console.log('Pinata authenticated:', testAuth);

  // Upload hidden metadata
  const hiddenMetadata = fs.readFileSync(path.join(__dirname, 'hidden.json'), 'utf8');
  const hiddenResult = await pinata.pinJSONToIPFS(JSON.parse(hiddenMetadata), {
    pinataMetadata: { name: 'hidden-metadata' }
  });
  console.log('Hidden metadata CID:', hiddenResult.IpfsHash);

  // Upload metadata folder
  const metadataFolder = path.join(__dirname);
  const folderResult = await pinata.pinFromFS(metadataFolder, {
    pinataMetadata: { name: 'nft-metadata' }
  });
  console.log('Metadata folder CID:', folderResult.IpfsHash);

  console.log('\n✅ Upload complete!');
  console.log('Base URI: ipfs://' + folderResult.IpfsHash + '/');
}

// Run the upload
if (process.env.USE_PINATA === 'true') {
  uploadToPinata().catch(console.error);
} else {
  uploadToIPFS().catch(console.error);
}
