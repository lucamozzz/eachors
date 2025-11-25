import { run } from 'hardhat';
import { readFileSync } from 'fs';
import { JsonRpcProvider, Wallet, ContractFactory } from 'ethers';

const provider = new JsonRpcProvider('http://localhost:7545');
const wallet = new Wallet('0x2f5afbc429d44565dc9231ea561248e6296865eebf4e68f43fcbf88b043e1cf5', provider);

async function deploy(physicalPlaces, physicalPlacesAttributeKeys, edges, logicalPlaces, logicalPlaceExpressions, logicalPlacesAttributeKeys, views, viewLogicalPlaces, viewAggregationsKeys, viewAggregationsValues) {
  console.log('Compiling smart contracts...');
  await run('compile');
  console.log('Done.');
  const envArtifact = JSON.parse(readFileSync('./artifacts/contracts/env.sol/Environment.json', 'utf8'));
  const chorArtifact = JSON.parse(readFileSync('./artifacts/contracts/experiment_1/Chor.sol/Chor.json', 'utf8'));
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
