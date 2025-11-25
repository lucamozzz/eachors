import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import solc from 'solc';
import { JsonRpcProvider, Wallet, ContractFactory, encodeBytes32String } from 'ethers';

// const provider = new JsonRpcProvider('http://localhost:7545');
const provider = new JsonRpcProvider('http://host.docker.internal:7545');
const wallet = new Wallet('0xc9d140b20f38ce22877b8ac9351ddf387189a45a72b96f0692ca1b2b7d2af4f9', provider);

function findImports(importPath) {
  try {
    const filePath = path.resolve('./contracts', importPath);
    const content = fs.readFileSync(filePath, 'utf8');
    return { contents: content };
  } catch (err) {
    return { error: 'File not found: ' + importPath };
  }
}

function compileContract(fileName) {
  const filePath = path.resolve('./contracts', fileName);
  const source = fs.readFileSync(filePath, 'utf8');

  const input = {
    language: 'Solidity',
    sources: {
      [fileName]: { content: source },
    },
    settings: {
      outputSelection: {
        '*': { '*': ['abi', 'evm.bytecode'] },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

  if (output.errors) {
    output.errors.forEach((err) => console.error(err.formattedMessage));
    if (output.errors.some((e) => e.severity === 'error')) {
      throw new Error('Compilation failed');
    }
  }

  const contractName = Object.keys(output.contracts[fileName])[0];
  const contract = output.contracts[fileName][contractName];

  return {
    abi: contract.abi,
    bytecode: contract.evm.bytecode.object,
    contractName,
  };
}

// async function deploy(physicalPlaces, physicalPlacesAttributeKeys, edges, logicalPlaces, logicalPlaceExpressions, logicalPlacesAttributeKeys, views, viewLogicalPlaces, viewAggregationsKeys, viewAggregationsValues) {
async function deploy() {
  console.log('Compiling smart contracts...');
  const envArtifact = compileContract('env.sol');
  const chorArtifact = compileContract('chor.sol');

  // const envArtifact = JSON.parse(fs.readFileSync('./artifacts/contracts/env.sol/Environment.json', 'utf8'));
  // const chorArtifact = JSON.parse(fs.readFileSync('./artifacts/contracts/chor.sol/Chor.json', 'utf8'));

  console.log('Deploying Environment contract...');
  const envFactory = new ContractFactory(envArtifact.abi, envArtifact.bytecode, wallet);
  console.log('Waiting for Environment deployment transaction to be mined...');
  const envContract = await envFactory.deploy(
    physicalPlaces,
    physicalPlacesAttributeKeys,
    edges,
    logicalPlaces,
    logicalPlaceExpressions,
    logicalPlacesAttributeKeys,
    views,
    viewLogicalPlaces,
    viewAggregationsKeys,
    viewAggregationsValues
  );
  console.log(`Environment deployed at address: ${envContract.target}`);
  console.log('Deploying Chor contract...');
  const chorFactory = new ContractFactory(chorArtifact.abi, chorArtifact.bytecode, wallet);
  console.log('Waiting for Chor deployment transaction to be mined...');
  const chorContract = await chorFactory.deploy(envContract.target);
  console.log(`Chor deployed at address: ${chorContract.target}`);
}

const app = express();
app.use(cors({ origin: 'http://localhost:9013' }));
app.use(bodyParser.text({ type: 'application/xml' }));
app.use(bodyParser.json());

app.options('/deploy', cors());
app.post('/deploy', async (req, res) => {
  try {
    await deploy(
      physicalPlaces,
      physicalPlacesAttributeKeys,
      edges,
      logicalPlaces,
      logicalPlaceExpressions,
      logicalPlacesAttributeKeys,
      views,
      viewLogicalPlaces,
      viewAggregationsKeys,
      viewAggregationsValues
    );

    res.status(200).json({ message: 'Deployment started' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Deployment failed' });
  }
});

app.listen(3000, () => console.log('Server listening on http://localhost:3000'));

let env = JSON.parse(fs.readFileSync('./env.json', 'utf-8'));
// let env_updated = JSON.parse(readFileSync('./env_updated.json', 'utf-8'));

function toBytes32(string) {
  return encodeBytes32String(string);
}

const physicalPlaces = env.physicalPlaces.map(p => toBytes32(p.id));
const physicalPlacesAttributeKeys = env.physicalPlaces.map(p => Object.keys(p.attributes).map(toBytes32));
const edges = env.edges.map(e => toBytes32(e.source.split('_')[1] + '_' + e.target.split('_')[1]));
const logicalPlaces = env.logicalPlaces.map(lp => toBytes32(lp.id));
const logicalPlaceExpressions = env.logicalPlaces.map(lp => lp.conditions.map(c => `${c.attribute} ${c.operator} ${c.value}`).join(` ${lp.operator} `));
const logicalPlacesAttributeKeys = env.logicalPlaces.map(lp => Object.keys(lp.attributes).map(toBytes32));
const views = env.views.map(v => toBytes32(v.id));
const viewLogicalPlaces = env.views.map(v => v.logicalPlaces.map(toBytes32));
const viewAggregationsKeys = env.views.map(v => Object.keys(v.aggregations).map(toBytes32));
const viewAggregationsValues = env.views.map(v => Object.values(v.aggregations).map(toBytes32));
// const physicalPlacesArgs = buildPhysicalPlacesArgs(env);
// const logicalPlacesArgs = buildLogicalPlacesArgs(env);
// const updatedPhysicalPlacesArgs = buildPhysicalPlacesArgs(env_updated);
// const updatedLogicalPlacesArgs = buildLogicalPlacesArgs(env_updated);
// const updateParticipantPathArgs = [
//   toBytes32('Firefighters Team'),
//   [toBytes32('FireDepartment')]
// ];
// const updateReachablesArgs = [
//   [toBytes32('ExclusiveGateway_0seo2yk')],
//   [true]
// ];

// async function buildPhysicalPlacesArgs(env) {
//   const ids = [];
//   const attributeKeysList = [];
//   const attributeValuesList = [];

//   for (const place of env.physicalPlaces) {
//     ids.push(toBytes32(place.id));

//     const keys = [];
//     const values = [];
//     for (const [k, v] of Object.entries(place.attributes)) {
//       keys.push(toBytes32(k));
//       values.push(toBytes32(String(v)));
//     }

//     attributeKeysList.push(keys);
//     attributeValuesList.push(values);
//   }

//   return [ids, attributeKeysList, attributeValuesList];
// }

// async function buildLogicalPlacesArgs(env) {
//   const ids = [];
//   const updatedPlacesList = [];
//   const attributeKeysList = [];
//   const attributeValuesList = [];

//   for (const lp of env.logicalPlaces) {
//     ids.push(toBytes32(lp.id));

//     const keys = [];
//     const values = [];
//     for (const [key, value] of Object.entries(lp.attributes || {})) {
//       keys.push(toBytes32(key));
//       values.push(toBytes32(String(value)));
//     }
//     attributeKeysList.push(keys);
//     attributeValuesList.push(values);

//     const matchingPhysicalPlaces = env.physicalPlaces.filter(pp => {
//       return lp.conditions.every(cond => {
//         const attrValue = pp.attributes[cond.attribute];
//         if (attrValue === undefined) return false;

//         switch (cond.operator) {
//         case '==':
//           return String(attrValue) === String(cond.value);
//         case '>':
//           return Number(attrValue) > Number(cond.value);
//         case '<':
//           return Number(attrValue) < Number(cond.value);
//         default:
//           return false;
//         }
//       });
//     });

//     const physicalPlaceIds = matchingPhysicalPlaces.map(pp => toBytes32(pp.id));
//     updatedPlacesList.push(physicalPlaceIds);
//   }

//   return [ids, attributeKeysList, attributeValuesList, updatedPlacesList];
// }